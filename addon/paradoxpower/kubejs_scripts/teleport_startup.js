
if (!global.px) {global.px= {}};

global.px.portalLifeTime = 40;

global.px.createPortalPair = function (entity, posA, posB) {
    let spawnPortal = (origin, target, yaw, uuid) => {
        // area_effect_cloud is invisible, has no AI, and doesn't interfere with blocks
        let portal = entity.level.createEntity('minecraft:area_effect_cloud')
        portal.setPosition(origin.x, origin.y, origin.z)
        portal.yaw = yaw;

        // Keep the cloud alive permanently and tag it for our tick loops
        portal.mergeNbt({
            Duration:2000000000,
            Radius: 0.0,
            RadiusPerTick: 0.0,
            RadiusOnUse:0.0,
            WaitTime: 0,
            Invulnerable: 1,
            Invisible: 1,
            Tags: ['paradoxpower_portal', 'paradoxpower_portal_' + uuid]
        });

        // Store destination coordinates in persistentData
        portal.persistentData.putDouble('paradoxpower_destX', target.x)
        portal.persistentData.putDouble('paradoxpower_destY', target.y)
        portal.persistentData.putDouble('paradoxpower_destZ', target.z)

        portal.persistentData.putLong('paradoxpower_portal_duration', entity.level.time + global.px.portalLifeTime)

        portal.spawn()
        return portal
    }

    spawnPortal(posA, posB, entity.yaw, entity.uuid)
    spawnPortal(posB, posA, entity.yaw + 180, entity.uuid)
};

global.px.openPortals = function(){

};



StartupEvents.registry('palladium:abilities', (event) => {
    event.create('paradoxpower:teleport_ray')
        .icon(palladium.createItemIcon('minecraft:ender_pearl'))
        .documentationDescription('Teleports the user to the block or entity they are looking at')

        .addProperty('range', 'float', 20, 'Max range of the teleport')
        .addProperty('swap', 'boolean', false, 'Swap with targetted entity')
        .addProperty('particle_red', 'float', 0.3, 'Red component of particle color')
        .addProperty('particle_green', 'float', 0.3, 'Green component of particle color')
        .addProperty('particle_blue', 'float', 0.3, 'Blue component of particle color')
        .addProperty('particle_scale', 'float', 0.5, 'Particle scale')
        .addProperty('particle_count', 'integer', 50, 'Particle amount')
        .addProperty('particle_position', 'string', 'both', 'Where to show particals. options: destination, source, both, neither')
        .addProperty('sound', 'string', 'minecraft:entity.enderman.teleport', 'Sound effect')
        .addProperty('sound_volume', 'float', 1.0, 'Sound volume')
        .addProperty('sound_pitch', 'float', 1.0, 'Sound pitch')

        .firstTick((entity, entry, holder, enabled) => {
            if (!enabled) return; // Ability is not enabled, return early.
            const yOffset = 1.0;
            const blockCenteringOffset = 0.5;
            let range = entry.getPropertyByName('range');
            const particleRed = entry.getPropertyByName('particle_red');
            const particleGreen = entry.getPropertyByName('particle_green');
            const particleBlue = entry.getPropertyByName('particle_blue');
            const particleScale = entry.getPropertyByName('particle_scale');
            const particleCount = entry.getPropertyByName('particle_count');
            const particlePosition = entry.getPropertyByName('particle_position');
            const sound = entry.getPropertyByName('sound');
            const volume = entry.getPropertyByName('sound_volume');
            const pitch = entry.getPropertyByName('sound_pitch');
            let swap = entry.getPropertyByName('swap');

            //reduce range to simulation distance if it exceeds it
            //hopfully will help with server/game load when teleporting around
            range = Math.min(range, (entity.level.getServer().getPlayerList().getSimulationDistance() * 16));

            //cast the ray and try to get a hit. will go through liquids, but not through non solid blocks like grass.
            const hit = entity.rayTrace(range, false);
            if (!hit) return;

            //check if target block is a good destination for the teleport. 
            //this check asumes the calling entity is a standerd 2 block high by 1 block wide, so may have problems with oversized entites.
            function checkClear(level, checkPos) {
                return (level.getBlockState(checkPos).blocksMotion() && !level.getBlockState(checkPos.above(1)).blocksMotion() && !level.getBlockState(checkPos.above(2)).blocksMotion());
            }

            //get a safe spot near the target block if the target block is not a good destination for the teleport.
            function findSafeSpotNear(level, centerPos) {
                const baseOffset = 2; // horizontal search radius
                let highOffset = 10; // vertical search distance above. allows a little more leeway for teleporting to the top of walls, cliffs etc, or through floors from below.

                // Determine the maximum height for search based on if the dimension has a ceiling or not, in the event that the target location is near the world height limit.
                let maxHeight;
                let dimension = level.dimensionType();
                if (dimension.hasCeiling() === true) {
                    maxHeight = dimension.MAX_Y - 3;
                } else {
                    maxHeight = dimension.MAX_Y;
                }
                highOffset = Math.min(maxHeight - centerPos.y, highOffset);

                let bestPos = null;
                let closestDistSq = Infinity;

                // step through the rectangular search area for the closest safe spot to the center position. this will unfortunately bias the selection towards the -x, -y, -z corner of the search area.
                for (let x = -baseOffset; x <= baseOffset; x++) {
                    for (let y = -baseOffset; y <= highOffset; y++) {
                        for (let z = -baseOffset; z <= baseOffset; z++) {
                            let checkPos = centerPos.offset(x, y, z);
                            if (checkClear(level, checkPos)) {
                                let distSq = centerPos.distSqr(checkPos);
                                if (distSq < closestDistSq) {
                                    closestDistSq = distSq;
                                    bestPos = checkPos;
                                }
                            }
                        }
                    }
                }
                return bestPos;
            }

            //get destination as block, even if target is an entity.
            let destBlock;
            if (hit.entity) {
                destBlock = hit.entity.blockPosition().below();
            } else if (hit.block) {
                swap = false; //cant swap the block.
                destBlock = hit.block.pos;
            } else {
                return;
            }

            //check destination block is clear, if not find a safe spot near it, if possible. if not possible, do nothing.
            if (!checkClear(entity.level, destBlock)) {
                destBlock = findSafeSpotNear(entity.level, destBlock);
            }
            if (!destBlock) return;

            //get source and destination coordinates, with offsets to center the destination on the center-top of the block.
            const sourceX = entity.x;
            const sourceY = entity.y;
            const sourceZ = entity.z;
            const destinationX = destBlock.x + blockCenteringOffset;
            const destinationY = destBlock.y + yOffset;
            const destinationZ = destBlock.z + blockCenteringOffset;

            //show particles and play sound at source location. delay the sound slightly to make sure it plays correctly.
            if (particlePosition === 'source' || particlePosition === 'both') {
                entity.server.runCommandSilent(
                    `particle minecraft:dust ${particleRed} ${particleGreen} ${particleBlue} ${particleScale} ${sourceX} ${sourceY + 1} ${sourceZ} 0.5 0.5 0.5 0 ${particleCount} force`
                );
            }
            entity.server.scheduleInTicks(5, () => {
                entity.server.runCommandSilent(
                    `playsound ${sound} master @a ${sourceX} ${sourceY} ${sourceZ} ${volume} ${pitch}`
                );
            });

            //teleport the calling entity to the destination block and if swap is true, teleport the targeted entity to the source block.
            if (swap === true) {
                hit.entity.teleportTo(sourceX, sourceY, sourceZ);
            }
            entity.teleportTo(destinationX, destinationY, destinationZ);

            //show particles and play sound at destination location. delay the sound slightly to make sure it plays correctly.
            if (particlePosition === 'destination' || particlePosition === 'both') {
                entity.server.runCommandSilent(
                    `particle minecraft:dust ${particleRed} ${particleGreen} ${particleBlue} ${particleScale} ${destinationX} ${destinationY + 1} ${destinationZ} 0.5 0.5 0.5 0 ${particleCount} force`
                );
            }
            entity.server.scheduleInTicks(5, () => {
                entity.server.runCommandSilent(
                    `playsound ${sound} master @a ${destinationX} ${destinationY} ${destinationZ} ${volume} ${pitch}`
                );
            });
        });
});

StartupEvents.registry('palladium:abilities', (event) => {
    event.create('paradoxpower:open_portal')
        .icon(palladium.createItemIcon('minecraft:ender_pearl'))
        .documentationDescription('Open a Portal to a target location, allowing for teleportation between the two locations.')

        .addProperty('particle_red', 'float', 0.3, 'Red component of particle color')
        .addProperty('particle_green', 'float', 0.3, 'Green component of particle color')
        .addProperty('particle_blue', 'float', 0.3, 'Blue component of particle color')
        .addProperty('particle_scale', 'float', 0.5, 'Particle scale')
        .addProperty('particle_count', 'integer', 50, 'Particle amount')
        .addProperty('sound', 'string', 'minecraft:entity.enderman.teleport', 'Sound effect')
        .addProperty('sound_volume', 'float', 1.0, 'Sound volume')
        .addProperty('sound_pitch', 'float', 1.0, 'Sound pitch')

        .firstTick((entity, entry, holder, enabled) => {
            if (!enabled) return; // Ability is not enabled, return early.
            entity.tell(entity.name + ' activated the Open Portal ability!');

            //check if destination set else return early with message

            //remove any prevous portals for player

            //create new portals taggin them to player and setting their duration for 1-2 seconds in the future
            let portals = entity.level.getEntities().filter(e => e.tags.contains('paradoxpower_portal_' + entity.uuid));

            portals.forEach(portal => {
                entity.tell('--- portal death ---');
                portal.kill();
            });

            let destX = entity.persistentData.getDouble('paradoxpower_destX')
            let destY = entity.persistentData.getDouble('paradoxpower_destY')
            let destZ = entity.persistentData.getDouble('paradoxpower_destZ')

            let posA = { x: entity.x + 2, y: entity.y, z: entity.z }
            let posB = { x: destX, y: destY, z: destZ }
            
            global.px.createPortalPair(entity, posA, posB)
            entity.tell('Summoned linked portal pair!')

        })

        .tick((entity, entry, holder, enabled) => {
            if (!enabled) return; // Ability is not enabled, return early.
            if (entity.level.time % 40 === 0) {
                entity.tell(entity.name + ' is keeping the Portals open.');
            }

            //deducte energy from player for keeping the portals open
            
            let portals = entity.level.getEntities().filter(e => e.tags.contains('paradoxpower_portal_' + entity.uuid));

            portals.forEach(portal => {
                portal.persistentData.putLong('paradoxpower_portal_duration', entity.level.time + global.px.portalLifeTime)
            });
        })
});

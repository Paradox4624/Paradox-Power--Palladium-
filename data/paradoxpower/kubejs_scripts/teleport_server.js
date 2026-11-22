const FlightHandler = Java.loadClass('net.threetag.palladium.entity.FlightHandler');

//every 2 seconds, check the players current dimension and if not already listed, add the dimension to the list of visited dimensions.
//also record the dimension as the last visited dimension if it isnt paradoxpower:the_inbetween
PlayerEvents.tick(event => {
    if (event.level.time % 40 === 0) {
        let visited = event.player.persistentData.paradoxpower_visiteddims || [];
        let dim = event.player.level.dimension.toString();

        if (dim !== 'paradoxpower:the_inbetween') {
            event.player.persistentData.putString("paradoxpower_lastvisiteddim", dim);
        }

        let found = visited.find(tag => {
            if (tag) {
                return tag.getAsString() === dim;
            } else {
                return false;
            }
        });
        if (found) { return; }
        visited.push(dim);
        event.player.persistentData.paradoxpower_visiteddims = visited;
    }
});

//temporary command for debugging
ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(
        Commands.literal('px_fix').executes(ctx => {
            let player = ctx.source.player
            if (!player) return 0


            let level = player.level;
            let levelType = level.dimensionType();
            player.tell('levelType.logicalHeight():' + levelType.logicalHeight());
            player.tell('levelType.height():' + levelType.height());
            player.tell('levelType.minY():' + levelType.minY());

            let flightHandler = player.palladium$getFlightHandler();
            player.tell('flightHandler.getFlightType():' + flightHandler.getFlightType());
            flightHandler.setFlightType(FlightHandler.FlightType.NORMAL);
            player.tell('flightHandler.getFlightType():' + flightHandler.getFlightType());
            player.tell('flightHandler.getPhase():' + flightHandler.getPhase());

            server.scheduleInTicks(1, () => {
                player.sendData('paradoxpower_enable_Flight', {});
            });


            /*
            player.tell('start flightHandler.getFlightType():' + flightHandler.getFlightType())
            //player.tell('flightHandler.FlightType.NONE:' + flightHandler.FlightType.NONE);
            if (flightHandler.getFlightType() == FlightHandler.FlightType.NONE) {
                player.tell('flightHandler.getFlightType() == FlightHandler.FlightType.NONE');
                SyncFlightStateMessage(player.getId(), true).sendToTracking(player);
                flightHandler.setFlightType(flightHandler.getAvailableFlightType(player))
            } else {
                player.tell('flightHandler.getFlightType() == FlightHandler.FlightType.NORMAL');
                SyncFlightStateMessage(player.getId(), false).sendToTracking(player);
                flightHandler.setFlightType(FlightHandler.FlightType.NONE)
            }
            player.tell('end flightHandler.getFlightType():' + flightHandler.getFlightType())

            */

            return 1
        })
    )
})

//command to set target destination for portal power. does nothing without the portal power.
ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(
        Commands.literal('px_portal')
            .executes(ctx => {
                let player = ctx.source.player
                if (!player) return 0

                let destX = player.persistentData.getDouble('paradoxpower_destX')
                let destY = player.persistentData.getDouble('paradoxpower_destY')
                let destZ = player.persistentData.getDouble('paradoxpower_destZ')
                let destDim = player.persistentData.getString('paradoxpower_destDim')
                player.tell('Current portal destination: ' + destX + " " + destY + " " + destZ + " " + destDim)

                return 1
            })
            .then(Commands.argument('x', Arguments.WORD.create(event))
                .then(Commands.argument('y', Arguments.WORD.create(event))
                    .then(Commands.argument('z', Arguments.WORD.create(event))
                        .executes(ctx => {
                            let player = ctx.source.player
                            if (!player) return 0

                            const destX = Arguments.WORD.getResult(ctx, "x")
                            const destY = Arguments.WORD.getResult(ctx, "y")
                            const destZ = Arguments.WORD.getResult(ctx, "z")
                            const destDim = player.level.dimension.toString();

                            player.persistentData.putDouble('paradoxpower_destX', destX);
                            player.persistentData.putDouble('paradoxpower_destY', destY);
                            player.persistentData.putDouble('paradoxpower_destZ', destZ);
                            player.persistentData.putString('paradoxpower_destDim', destDim);
                            player.tell('New portal destination set: ' + destX + " " + destY + " " + destZ + " " + destDim)

                            return 1
                        })
                        .then(Commands.argument('dimension', Arguments.STRING.create(event))
                            .suggests((context, builder) => {
                                const player = context.source.player
                                if (!player) return builder.buildFuture()

                                // Read the player's persistentData (defaults to empty array if not set)
                                let visited = player.persistentData.paradoxpower_visiteddims || [];

                                // Iterate through the list and suggest items that match the user's current input
                                const remaining = builder.getRemaining().toLowerCase();
                                visited.forEach(item => {
                                    if (item.getAsString().toLowerCase().startsWith(remaining)) {
                                        builder.suggest(item.toString());
                                    }
                                });

                                return builder.buildFuture();
                            })
                            .executes(ctx => {
                                let player = ctx.source.player
                                if (!player) return 0

                                const destX = Arguments.WORD.getResult(ctx, "x")
                                const destY = Arguments.WORD.getResult(ctx, "y")
                                const destZ = Arguments.WORD.getResult(ctx, "z")
                                let destDim = Arguments.STRING.getResult(ctx, "dimension")

                                let visited = player.persistentData.paradoxpower_visiteddims || [];

                                let found = visited.find(tag => {
                                    if (tag) {
                                        return tag.getAsString() === destDim;
                                    } else {
                                        return false;
                                    }
                                });
                                if (!found) {
                                    destDim = player.level.dimension.toString();
                                }

                                player.persistentData.putDouble('paradoxpower_destX', destX);
                                player.persistentData.putDouble('paradoxpower_destY', destY);
                                player.persistentData.putDouble('paradoxpower_destZ', destZ);
                                player.persistentData.putString('paradoxpower_destDim', destDim);
                                player.tell('New portal destination set: ' + destX + " " + destY + " " + destZ + " " + destDim)

                                return 1
                            })
                        )
                    )
                )
            )
    )
})


//level tick script to update portals and do any teleporting. only run on every 3rd tick.
LevelEvents.tick(event => {
    const { level } = event
    if (level.clientSide || level.time % 3 !== 0) return

    // Find all portal entities in the loaded level
    let portals = level.getEntities().filter(e => e.tags.contains('paradoxpower_portal'))

    const teleportCooldown = 40; // 2 seconds cooldown between teleports
    const particleStepMod = 3; //delay particle spawning to create nicer staggered spawning

    portals.forEach(portal => {
        let duration = portal.persistentData.getLong('paradoxpower_portal_duration')
        if (level.time > duration) {
            global.px.killPortal(portal);
            return;
        }

        let radYaw = portal.yaw * (3.141592653589793 / 180);
        let particleDelayStep = portal.persistentData.getLong('paradoxpower_portal_delay_step') || 0;

        //particles
        let particleSpeed = 0.2; // Adjust speed multiplier
        let particleFwdX = -Math.sin(radYaw);
        let particleFwdZ = Math.cos(radYaw);
        let particleRightX = -particleFwdZ;
        let particleRightZ = particleFwdX;

        let halfSize = 1.5;
        let step = 0.25;

        let particleCenterX = portal.x - particleFwdX;
        let particleCenterY = portal.y + halfSize;
        let particleCenterZ = portal.z - particleFwdZ;

        let particleType = 'paradoxpower:portal';  //'minecraft:glow_squid_ink';

        function particleStep() { //addvance the particle step and check if particle is next to spawn
            particleDelayStep += 1;
            if (particleDelayStep % particleStepMod == 0) return true;
            return false;
        }

        //spawns portal frame particles, both trails and border
        function spawnParticle1(x, y, z) {
            if (particleStep()) {
                //trail particles
                level.spawnParticles('minecraft:soul_fire_flame', true,
                    x,
                    y,
                    z,
                    particleFwdX, 0, particleFwdZ, 0, particleSpeed
                );
                //frame particles
                level.spawnParticles('minecraft:scrape', true,
                    x,
                    y,
                    z,
                    0.1, 0.1, 0.1, 5, 0
                );
            };
        }

        //interate over length of boarder and draw 4 lines of particles.
        for (let q = -halfSize; q <= halfSize; q += step) {
            spawnParticle1(
                particleCenterX + (particleRightX * q),
                particleCenterY + halfSize,
                particleCenterZ + (particleRightZ * q)
            );
            spawnParticle1(
                particleCenterX + (particleRightX * (-q)),
                particleCenterY - halfSize,
                particleCenterZ + (particleRightZ * (-q))
            );
            spawnParticle1(
                particleCenterX + (particleRightX * halfSize),
                particleCenterY - q,
                particleCenterZ + (particleRightZ * halfSize),
            );
            spawnParticle1(
                particleCenterX - (particleRightX * halfSize),
                particleCenterY + q,
                particleCenterZ - (particleRightZ * halfSize)
            );
        }

        //store the particle stagering variable to continue on next pass
        portal.persistentData.putLong('paradoxpower_portal_delay_step', particleDelayStep);

        // Define a collision box using the 1.2425 radius sweet spot above the portal entity. bringing it in s little from the full 3 x 3 x 3 of the portal frame/trails
        const sweetSpot = 1.2425
        let box = AABB.of(
            portal.x - sweetSpot, portal.y + 0.05, portal.z - sweetSpot,
            portal.x + sweetSpot, portal.y + 2.95, portal.z + sweetSpot
        );

        let destX = portal.persistentData.getDouble('paradoxpower_destX')
        let destY = portal.persistentData.getDouble('paradoxpower_destY')
        let destZ = portal.persistentData.getDouble('paradoxpower_destZ')
        let destBlock = BlockPos(destX, destY, destZ).below();
        let destDim = portal.server.getLevel(portal.persistentData.getString('paradoxpower_destDim'))

        if (!destDim) return;

        // variables for the push/pull when entering/leaving the portals
        let motionSpeed = 1.0;
        let motionX = -Math.sin(radYaw) * motionSpeed;
        let motionZ = Math.cos(radYaw) * motionSpeed;

        // Check all entities colliding with the box
        level.getEntitiesWithin(box).forEach(target => {

            // Ignore the portals themselves and only target dropped items, living mobs and players
            if (target.tags.contains('paradoxpower_portal') || (!target.type == 'minecraft:item' && !target.isLiving() && !target.type == 'minecraft:player')) return

            // Check cooldown so entities don't loop infinitely (40 ticks = 2 seconds)
            let lastTp = target.persistentData.getLong('paradoxpower_portal_cd')
            if (level.time - lastTp < teleportCooldown) return

            // Update cooldown and teleport
            target.persistentData.putLong('paradoxpower_portal_cd', level.time)

            target.setMotion(motionX, 0, motionZ); //pull into portal
            target.hurtMarked = true; // Ensures velocity updates properly on the client/server for some entities

            if (target.type == 'minecraft:player') target.potionEffects.add('minecraft:blindness', 20, 0, false, false) // blindness adds a little something to being ported.

            //schedule the teleport to allow the pull to playout
            target.server.scheduleInTicks(5, () => {
                global.px.teleportTo(target, portal.blockPosition().below(), portal.level, destBlock, destDim, 1.5)
            });

            //schedule the push to happen the tick after the teleport completes
            target.server.scheduleInTicks(6, () => {
                target.setMotion(motionX, 0, motionZ); //push out of portal
                target.hurtMarked = true; // Ensures velocity updates properly on the client/server for some entities
            });

        })
    })
})



//teleport falling entities in The Inbetween if they fall below minY
LevelEvents.tick(event => {
    const { level, server } = event;

    if (level.time % 10 !== 0) return;
    if (level.dimension.toString() !== 'paradoxpower:the_inbetween') return;

    const overworld = server.getLevel('minecraft:overworld');
    if (!overworld) return;
    const targetY = overworld.dimensionType().logicalHeight() - 5;
    const minY = level.dimensionType().minY();

    // Get all loaded entities in the void dimension
    level.entities.forEach(entity => {
        if (entity.y >= minY) return;

        // Teleport to Overworld at the same X and Z coordinates
        global.px.teleportTo(entity, entity.blockPosition().below(), entity.level, BlockPos(entity.x, targetY, entity.z), overworld, 1)
    });
});

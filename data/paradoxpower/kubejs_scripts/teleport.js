// Load Java's SharedSuggestionProvider helper to easily turn JS arrays into Brigadier suggestions
const $SharedSuggestionProvider = Java.loadClass('net.minecraft.commands.SharedSuggestionProvider')

/*
ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event

    event.register(
        Commands.literal('warp')
            .then(
                Commands.argument('destination', Arguments.STRING.create(event))
                    // Attach custom tab-completion suggestions to the argument
                    .suggests((context, builder) => {
                        const player = context.source.player
                        
                        // Safety check in case a command block or server console runs it
                        if (!player) return builder.buildFuture()

                        // Read the player's persistentData (defaults to empty array if not set)
                        const warps = player.persistentData.unlockedWarps || []
                        
                        // Convert the NBT/JS list into a clean JS string array for Brigadier
                        const suggestions = []
                        for (let i = 0; i < warps.length; i++) {
                            // If stored as an NBT ListTag, .getString(i) or String() extracts the text
                            suggestions.push(String(warps[i]).replace(/^"|"$/g, ''))
                        }

                        // Automatically filters suggestions based on what the player has typed so far
                        return $SharedSuggestionProvider.suggest(suggestions, builder)
                    })
                    .executes(ctx => {
                        const player = ctx.source.player
                        const dest = Arguments.STRING.getResult(ctx, 'destination')
                        
                        player.tell(`Teleporting to: ${dest}`)
                        return 1
                    })
            )
    )
})




                            .suggests((context, builder) => {
                                const player = context.source.player
                                
                                // Safety check in case a command block or server console runs it
                                if (!player) return builder.buildFuture()

                                // Read the player's persistentData (defaults to empty array if not set)
                                let visited = player.persistentData.paradoxpower_visiteddims;
                            
                                // Automatically filters suggestions based on what the player has typed so far
                                return $SharedSuggestionProvider.suggest(visited, builder)
                            })

*/



PlayerEvents.tick(event => {
    console.log("start player dim check tick script");
    if (event.player.age % 40 === 0) {
        let visited = event.player.persistentData.paradoxpower_visiteddims || [];
        let dim = event.player.level.dimension.toString();
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
        event.player.tell("adding worlds:");
        event.player.tell(visited.toString());
    }
});



ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(
        Commands.literal('px_fix').executes(ctx => {
            let player = ctx.source.player
            if (!player) return 0

            player.persistentData.paradoxpower_visiteddims = ["jj"];
            return 1
        })
    )
})

ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(
        Commands.literal('px_portal')
            .then(Commands.argument('x', Arguments.WORD.create(event))
                .then(Commands.argument('y', Arguments.WORD.create(event))
                    .then(Commands.argument('z', Arguments.WORD.create(event))
                        .executes(ctx => {
                            let player = ctx.source.player
                            if (!player) return 0

                            const x = Arguments.WORD.getResult(ctx, "x")
                            const y = Arguments.WORD.getResult(ctx, "y")
                            const z = Arguments.WORD.getResult(ctx, "z")
                            const dim = player.level.dimension.toString();

                            player.persistentData.putDouble('paradoxpower_destX', x);
                            player.persistentData.putDouble('paradoxpower_destY', y);
                            player.persistentData.putDouble('paradoxpower_destZ', z);
                            player.persistentData.putDouble('paradoxpower_destDim', dim);
                            player.tell('Setting destination');
                            return 1
                        })
                        .then(Commands.argument('dimension', Arguments.WORD.create(event))

                            .executes(ctx => {
                                let player = ctx.source.player
                                if (!player) return 0

                                const x = Arguments.WORD.getResult(ctx, "x")
                                const y = Arguments.WORD.getResult(ctx, "y")
                                const z = Arguments.WORD.getResult(ctx, "z")
                                const dim = Arguments.WORD.getResult(ctx, "dimension")

                                player.persistentData.putDouble('paradoxpower_destX', x);
                                player.persistentData.putDouble('paradoxpower_destY', y);
                                player.persistentData.putDouble('paradoxpower_destZ', z);
                                player.persistentData.putDouble('paradoxpower_destDim', dim);
                                player.tell('Setting destination');
                                return 1
                            })
                        )
                    )
                )
            )
    )
})



LevelEvents.tick(event => {
    const { level } = event
    if (level.clientSide || level.time % 4 !== 0) return

    console.log("start portal tick script");

    // Find all portal entities in the loaded level
    let portals = level.getEntities().filter(e => e.tags.contains('paradoxpower_portal'))

    const teleportCooldown = 40; // 2 seconds in ticks
    portals.forEach(portal => {
        let duration = portal.persistentData.getLong('paradoxpower_portal_duration')
        if (level.time > duration) {
            portal.tell('--- portal death ---');
            portal.kill();
            return;
        }


        let radYaw = portal.yaw * (3.141592653589793 / 180);

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

        const rndStrength = 0.3;

        function randomFloatRange(x) {
            return (Math.random() * 2 - 1) * x;
        }

        for (let q = -halfSize; q <= halfSize; q += step) {
            level.spawnParticles(particleType, true,
                particleCenterX + (particleRightX * q) + randomFloatRange(rndStrength),
                particleCenterY + halfSize + randomFloatRange(rndStrength),
                particleCenterZ + (particleRightZ * q) + randomFloatRange(rndStrength),
                particleFwdX, 0, particleFwdZ, 0, particleSpeed);
            level.spawnParticles(particleType, true,
                particleCenterX + (particleRightX * q) + randomFloatRange(rndStrength),
                particleCenterY - halfSize + randomFloatRange(rndStrength),
                particleCenterZ + (particleRightZ * q) + randomFloatRange(rndStrength),
                particleFwdX, 0, particleFwdZ, 0, particleSpeed
            );
            level.spawnParticles(particleType, true,
                particleCenterX + (particleRightX * halfSize) + randomFloatRange(rndStrength),
                particleCenterY + q + randomFloatRange(rndStrength),
                particleCenterZ + (particleRightZ * halfSize) + randomFloatRange(rndStrength),
                particleFwdX, 0, particleFwdZ, 0, particleSpeed
            );
            level.spawnParticles(particleType, true,
                particleCenterX - (particleRightX * halfSize) + randomFloatRange(rndStrength),
                particleCenterY + q + randomFloatRange(rndStrength),
                particleCenterZ - (particleRightZ * halfSize) + randomFloatRange(rndStrength),
                particleFwdX, 0, particleFwdZ, 0, particleSpeed
            );
        }

        level.spawnParticles('minecraft:end_rod', true,
            portal.x,
            particleCenterY,
            portal.z,
            0.1, 0.1, 0.1, 100, 0.04
        );

        // Define a 1.5x2x1.5 collision box around the portal entity
        let box = AABB.of(
            portal.x - 0.75, portal.y, portal.z - 0.75,
            portal.x + 0.75, portal.y + 2.0, portal.z + 0.75
        );

        let destX = portal.persistentData.getDouble('paradoxpower_destX')
        let destY = portal.persistentData.getDouble('paradoxpower_destY')
        let destZ = portal.persistentData.getDouble('paradoxpower_destZ')

        let motionSpeed = 1.0; // Adjust speed multiplier
        let motionX = -Math.sin(radYaw) * motionSpeed;
        let motionZ = Math.cos(radYaw) * motionSpeed;

        // Check all entities colliding with the box
        level.getEntitiesWithin(box).forEach(target => {

            // Ignore the portals themselves
            if (target.tags.contains('paradoxpower_portal')) return

            // Check cooldown so entities don't loop infinitely (40 ticks = 2 seconds)
            let lastTp = target.persistentData.getLong('paradoxpower_portal_cd')
            if (level.time - lastTp < teleportCooldown) return

            // Update cooldown and teleport
            target.persistentData.putLong('paradoxpower_portal_cd', level.time)


            target.setMotion(motionX, 0, motionZ);
            target.hurtMarked = true; // Ensures velocity updates properly on the client/server for some entities

            target.server.scheduleInTicks(5, () => {
                portal.tell('teleporting: ' + target.name);
                target.teleportTo(destX, destY, destZ)
                level.playSound(null, destX, destY, destZ, 'minecraft:entity.enderman.teleport', 'neutral', 1.0, 1.0)
            });

            target.server.scheduleInTicks(6, () => {
                target.setMotion(motionX, 0, motionZ);
                target.hurtMarked = true; // Ensures velocity updates properly on the client/server for some entities
            });

        })
    })
})

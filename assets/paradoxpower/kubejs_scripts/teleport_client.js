const FlightHandler = Java.loadClass('net.threetag.palladium.entity.FlightHandler');

global.px.checkAndChangeFlightCounter = 0;

global.px.checkAndChangeFlight = function (event) {
    let player = event.player
    if (!player) return

    if (FlightHandler.getAvailableFlightType(player) == FlightHandler.FlightType.NORMAL) {
        //player has flight type so we are good to remove creative flight and swap to Palladium lfight
        player.abilities.mayfly = false;
        player.abilities.flying = false;
        player.setMotion(0,0,0);
        player.hurtMarked = true
        player.onUpdateAbilities()
        let flightHandler = player.palladium$getFlightHandler();
        flightHandler.setFlightType(FlightHandler.FlightType.NORMAL);
    } else {
        //player doesnt have flight type yet so may not have loaded enough
        //so if timeout hasnt runout, advance timout and schedule to check again next tick
        if (global.px.checkAndChangeFlightCounter > 100) {
            global.px.checkAndChangeFlightCounter = 0;
            return;
        } else {
            global.px.checkAndChangeFlightCounter = global.px.checkAndChangeFlightCounter + 1;
            Client.scheduleInTicks(1, () => { global.px.checkAndChangeFlight(event) })
        }
    }
}

NetworkEvents.dataReceived('paradoxpower_enable_Flight', event => {
    //set timeout counter and attempt to change flight type on client side
    global.px.checkAndChangeFlightCounter = 0;
    global.px.checkAndChangeFlight(event);
});


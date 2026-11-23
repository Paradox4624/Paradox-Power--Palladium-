const FlightHandler = Java.loadClass('net.threetag.palladium.entity.FlightHandler');

global.px.checkAndChangeFlightCounter = 0;

global.px.checkAndChangeFlight = function (event) {
    if (!event) return;

    let player = event.player;
    if (!player) return;

    if (FlightHandler.getAvailableFlightType(player) == FlightHandler.FlightType.NORMAL) {
        //player has flight type so we are good to remove creative flight and swap to Palladium lfight
        player.setMotion(0, 0, 0);
        player.hurtMarked = true
        player.abilities.flying = false;
        player.onUpdateAbilities()
        let flightHandler = player.palladium$getFlightHandler();
        flightHandler.setFlightType(FlightHandler.FlightType.NORMAL);
    } else {
        //player doesnt have flight type yet so may not have loaded enough
        //so if timeout hasnt runout, advance timout and schedule to check again next tick
        if (global.px.checkAndChangeFlightCounter > 100) {
            global.px.checkAndChangeFlightCounter = 0;
            player.abilities.flying = false;
            player.onUpdateAbilities()
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


NetworkEvents.dataReceived('paradoxpower_debug_check', event => {
    if (!event) return;

    let player = event.player;
    if (!player) return;

    let flightHandler = player.palladium$getFlightHandler();

    player.tell('C---')
    player.tell('FlightHandler.getAvailableFlightType(player):' + FlightHandler.getAvailableFlightType(player));
    player.tell('flightHandler.getPhase():' + flightHandler.getPhase());
    player.tell('player.deltaMovement :' + player.deltaMovement);
    player.tell('flightHandler.getPrevMovementDelta():' + flightHandler.getPrevMovementDelta());
    player.tell('flightHandler.getAnimationState():' + flightHandler.getAnimationState());

});



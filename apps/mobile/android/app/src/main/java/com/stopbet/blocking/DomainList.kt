package com.stopbet.blocking

/**
 * Lista fija del PoC del SPIKE 2 (CA2). En HdU15/HdU18 esto sale del backend, no del código.
 *
 * Dos grupos, y la separación es a propósito:
 *  - SUBTEL: nómina oficial del 01-09-2026. Los ISP chilenos YA bloquean estos dominios por DNS,
 *    así que en una red chilena aparecen bloqueados aunque la VPN esté apagada. Sirven para
 *    mostrar cobertura local, no para demostrar que el bloqueo es nuestro.
 *  - CONTROL: casas de apuestas internacionales fuera de la nómina. Ningún ISP chileno las
 *    corta, así que son las que prueban que el bloqueo lo hace StopBet: con la VPN cargan,
 *    sin ella no.
 */
object DomainList {

  private val SUBTEL = listOf(
      "lat.betano.com", "coolbet.com", "coolbetchile.com", "1xbet.com",
      "chile.1xbet.com", "betsson.com", "betsson1001.com", "rojabet.cl",
      "rojabet.com", "betsala.com", "betsala11.com", "micasino.com",
      "micasinoenvivo.com", "jugabet.cl", "stake.com", "allsport365.com",
      "z2.bet365.com", "1wins.cl", "estelarbet.cl", "estelarbet.vip",
      "juegalo.com", "apuestasroyal.com", "cl.novibet.com", "epicbet.com",
      "bc.game", "playglobal5.com", "rabona.com", "rab0na-2417.com",
      "pin-up.world", "latamwinonline.com", "melbet.com", "tikitaka.com",
      "tonybet.com", "betfury.com", "bet7k.cl", "doradobet.com",
      "winchile.com", "jackpotcitycasino.com", "juegaconelking.com", "casinonano.com",
      "nayafacil-903.com", "betcris.com",
  )

  private val CONTROL = listOf(
      "pokerstars.com", "bwin.com", "888casino.com", "williamhill.com",
      "unibet.com", "draftkings.com", "fanduel.com", "ladbrokes.com",
      // Betway y Betfair NO van acá: entraron en la orden de Subtel del 21-09-2026.
      "paddypower.com", "bovada.lv", "betmgm.com", "skybet.com",
  )

  private val domains: Set<String> = (SUBTEL + CONTROL).toHashSet()

  val size: Int get() = domains.size

  /**
   * Bloquea el dominio y todos sus subdominios: `www.bwin.com` cae por `bwin.com`. Un archivo
   * hosts sería coincidencia exacta y dejaría pasar los subdominios (ver §3.3 del Spike).
   */
  fun isBlocked(rawName: String): Boolean {
    var name = rawName.lowercase().trimEnd('.')
    while (true) {
      if (name in domains) return true
      val dot = name.indexOf('.')
      if (dot < 0) return false
      name = name.substring(dot + 1)
    }
  }
}

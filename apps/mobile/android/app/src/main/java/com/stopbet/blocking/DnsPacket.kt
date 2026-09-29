package com.stopbet.blocking

/**
 * Lo mínimo para leer una consulta DNS que llega por la interfaz de la VPN y armar la
 * respuesta. Solo IPv4 + UDP: la interfaz se configura sin IPv6, así que no llega otra cosa.
 * Sin librerías a propósito: las que hacen esto (DNS66, personalDNSfilter) son GPL.
 */
class DnsQuery(
    val packet: ByteArray,
    private val ipHeaderLength: Int,
    val dnsPayload: ByteArray,
    val name: String,
) {
  /** Envuelve una respuesta DNS en IPv4/UDP con origen y destino invertidos. */
  fun wrapResponse(dnsResponse: ByteArray): ByteArray {
    val udpLength = 8 + dnsResponse.size
    val totalLength = 20 + udpLength
    val out = ByteArray(totalLength)

    out[0] = 0x45 // IPv4, cabecera de 20 bytes
    writeShort(out, 2, totalLength)
    out[6] = 0x40 // no fragmentar
    out[8] = 64 // TTL
    out[9] = 17 // UDP
    System.arraycopy(packet, 16, out, 12, 4) // origen = destino de la consulta
    System.arraycopy(packet, 12, out, 16, 4) // destino = origen de la consulta
    writeShort(out, 10, ipChecksum(out, 20))

    System.arraycopy(packet, ipHeaderLength + 2, out, 20, 2) // puerto origen = 53
    System.arraycopy(packet, ipHeaderLength, out, 22, 2) // puerto destino = el de la app
    writeShort(out, 24, udpLength)
    // Checksum UDP en 0: en IPv4 significa "no calculado" y es válido.
    System.arraycopy(dnsResponse, 0, out, 28, dnsResponse.size)
    return out
  }

  /**
   * NXDOMAIN ("ese dominio no existe"). Se prefiere a responder 0.0.0.0: el navegador muestra
   * su propia página de error al instante en vez de quedarse esperando una conexión.
   */
  fun nxdomain(): ByteArray {
    val questionEnd = questionEnd(dnsPayload) ?: dnsPayload.size
    val out = dnsPayload.copyOf(questionEnd)
    val rd = out[2].toInt() and 0x01
    out[2] = (0x80 or (out[2].toInt() and 0x78) or rd).toByte() // QR=1, mismo opcode y RD
    out[3] = (0x80 or 0x03).toByte() // RA=1, RCODE=3
    for (i in 6 until 12) out[i] = 0 // sin respuestas, autoridad ni adicionales
    return out
  }

  companion object {
    fun parse(packet: ByteArray, length: Int): DnsQuery? {
      if (length < 20 || (packet[0].toInt() shr 4) != 4) return null
      val ihl = (packet[0].toInt() and 0x0F) * 4
      if (packet[9].toInt() != 17 || length < ihl + 8) return null
      if (readShort(packet, ihl + 2) != 53) return null

      val udpLength = readShort(packet, ihl + 4)
      val payloadLength = minOf(udpLength - 8, length - ihl - 8)
      if (payloadLength < 12) return null
      val payload = packet.copyOfRange(ihl + 8, ihl + 8 + payloadLength)
      if (readShort(payload, 4) < 1) return null // sin preguntas

      val name = readName(payload) ?: return null
      return DnsQuery(packet.copyOf(length), ihl, payload, name)
    }

    private fun readName(dns: ByteArray): String? {
      val sb = StringBuilder()
      var i = 12
      while (i < dns.size) {
        val len = dns[i].toInt() and 0xFF
        if (len == 0) return sb.toString()
        if (len and 0xC0 != 0) return null // compresión: no aparece en una pregunta
        if (i + 1 + len > dns.size) return null
        if (sb.isNotEmpty()) sb.append('.')
        sb.append(String(dns, i + 1, len, Charsets.US_ASCII))
        i += 1 + len
      }
      return null
    }

    private fun questionEnd(dns: ByteArray): Int? {
      var i = 12
      while (i < dns.size) {
        val len = dns[i].toInt() and 0xFF
        if (len == 0) return (i + 1 + 4).takeIf { it <= dns.size } // + QTYPE y QCLASS
        i += 1 + len
      }
      return null
    }

    private fun readShort(b: ByteArray, at: Int) =
        ((b[at].toInt() and 0xFF) shl 8) or (b[at + 1].toInt() and 0xFF)

    private fun writeShort(b: ByteArray, at: Int, value: Int) {
      b[at] = (value shr 8).toByte()
      b[at + 1] = value.toByte()
    }

    private fun ipChecksum(b: ByteArray, length: Int): Int {
      var sum = 0
      for (i in 0 until length step 2) sum += readShort(b, i)
      while (sum shr 16 != 0) sum = (sum and 0xFFFF) + (sum shr 16)
      return sum.inv() and 0xFFFF
    }
  }
}

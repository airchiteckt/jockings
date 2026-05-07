import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Mappa prefisso telefonico → ISO country code per libphonenumber.
 * Allineata a COUNTRY_CODES in CreatePrank.tsx.
 */
const DIAL_TO_ISO: Record<string, CountryCode> = {
  "+39": "IT",
  "+49": "DE",
  "+33": "FR",
  "+34": "ES",
  "+44": "GB",
  "+41": "CH",
  "+43": "AT",
  "+31": "NL",
  "+32": "BE",
  "+351": "PT",
  "+48": "PL",
  "+30": "GR",
};

export interface PhoneNormalizationResult {
  /** Numero in formato E.164 (es. "+393475089673") se valido, altrimenti null. */
  e164: string | null;
  /** Numero formattato in stile internazionale leggibile (es. "+39 347 508 9673"). */
  formatted: string | null;
  /** True se il numero è valido per il paese selezionato. */
  isValid: boolean;
  /** Solo le cifre nazionali (senza prefisso paese). Utile per repopolare l'input. */
  nationalDigits: string | null;
}

/**
 * Normalizza un numero di telefono in E.164 partendo da:
 *  - countryDialCode: il prefisso selezionato dall'utente (es. "+39")
 *  - rawInput: ciò che l'utente ha digitato nel campo numero (può contenere
 *    spazi, trattini, un altro "+39", un "0039", o solo cifre)
 *
 * Logica:
 *  1. Se l'input inizia con "+" o "00" → è già internazionale, usa quello (countryDialCode ignorato).
 *  2. Altrimenti combiniamo countryDialCode + cifre dell'input.
 *  3. libphonenumber-js valida usando la lunghezza/pattern del paese:
 *     se il risultato è invalido E le cifre dell'input iniziano con il prefisso
 *     paese senza il "+", proviamo a interpretarlo come numero internazionale
 *     già completo (es. utente scrive "39 347…" col +39 selezionato → niente duplicato).
 */
export function normalizeE164(
  rawInput: string,
  countryDialCode: string
): PhoneNormalizationResult {
  const empty: PhoneNormalizationResult = {
    e164: null,
    formatted: null,
    isValid: false,
    nationalDigits: null,
  };

  if (!rawInput || !rawInput.trim()) return empty;

  const isoCountry = DIAL_TO_ISO[countryDialCode];
  // Pulizia base: tieni solo cifre e il "+"
  const cleaned = rawInput.replace(/[^\d+]/g, "");
  const dialDigits = countryDialCode.replace(/\D/g, ""); // "+39" → "39"

  // Costruisce le candidate da provare in ordine di preferenza
  const candidates: string[] = [];

  if (cleaned.startsWith("+")) {
    // L'utente ha già messo un prefisso internazionale: usalo, ignora il selettore.
    candidates.push(cleaned);
  } else if (cleaned.startsWith("00")) {
    // 0039 333... → +39 333...
    candidates.push("+" + cleaned.slice(2));
  } else {
    const digits = cleaned;

    // Candidata 1: prepend del prefisso selezionato (caso normale, es. "333..." → "+39333...")
    candidates.push(countryDialCode + digits);

    // Candidata 2: l'utente potrebbe aver già scritto il prefisso paese senza "+"
    // (es. "39 333..." con +39 selezionato). Da provare SOLO se le cifre iniziano
    // col dial code, altrimenti rischiamo di tagliare numeri legittimi.
    if (digits.startsWith(dialDigits)) {
      candidates.push("+" + digits);
    }
  }

  // Prova ogni candidata: la prima valida vince.
  // Wrappiamo in try/catch perché libphonenumber-js può lanciare eccezioni
  // su input parziali in alcuni browser (es. iOS 26 WebKit), causando white-screen.
  for (const candidate of candidates) {
    try {
      const parsed = parsePhoneNumberFromString(candidate, isoCountry);
      if (parsed && parsed.isValid()) {
        return {
          e164: parsed.number,
          formatted: parsed.formatInternational(),
          isValid: true,
          nationalDigits: parsed.nationalNumber.toString(),
        };
      }
    } catch (err) {
      // Ignora e prova la prossima candidata
      console.warn("phone parse error", err);
    }
  }

  // Nessuna candidata valida — proviamo comunque a fornire un best-effort
  // per permettere alla UI di mostrare cosa abbiamo interpretato.
  try {
    const fallback = parsePhoneNumberFromString(candidates[0], isoCountry);
    return {
      e164: null,
      formatted: fallback?.formatInternational() ?? null,
      isValid: false,
      nationalDigits: fallback?.nationalNumber?.toString() ?? null,
    };
  } catch {
    return empty;
  }
}

/** Shortcut: ritorna true se il numero risulta valido. */
export function isValidPhone(rawInput: string, countryDialCode: string): boolean {
  return normalizeE164(rawInput, countryDialCode).isValid;
}

/**
 * Estrae le cifre nazionali da un numero E.164 già salvato, dato il prefisso paese.
 * Usato quando ricarichiamo un draft / parametro URL nel form.
 * Più affidabile di `phone.replace(countryCode, "")` perché parsa con libphonenumber.
 */
export function extractNationalDigits(
  fullPhone: string,
  countryDialCode: string
): { dialCode: string; nationalDigits: string } {
  const isoCountry = DIAL_TO_ISO[countryDialCode];
  const parsed = parsePhoneNumberFromString(fullPhone, isoCountry);
  if (parsed) {
    const detectedDial = "+" + parsed.countryCallingCode;
    return {
      dialCode: detectedDial in DIAL_TO_ISO ? detectedDial : countryDialCode,
      nationalDigits: parsed.nationalNumber.toString(),
    };
  }
  // Fallback: vecchia logica string-replace
  const stripped = fullPhone.startsWith(countryDialCode)
    ? fullPhone.slice(countryDialCode.length).trim()
    : fullPhone;
  return { dialCode: countryDialCode, nationalDigits: stripped.replace(/\D/g, "") };
}

/** Error codes raised by the Postgres booking functions → Spanish UI messages. */
const MESSAGES: Record<string, string> = {
  SLOT_UNAVAILABLE:
    "Esa hora ya no está disponible. Alguien la tomó hace un momento. Por favor elige otra.",
  PHONE_LIMIT:
    "Este teléfono ya tiene 2 horas reservadas. Si necesitas otra, llámanos.",
  INVALID_PHONE: "Revisa tu teléfono. Debe tener 9 dígitos, por ejemplo 9 1234 5678.",
  INVALID_NAME: "Escribe tu nombre (al menos 2 letras).",
  SERVICE_NOT_FOUND: "Ese servicio ya no está disponible. Elige otro.",
  NO_BARBER: "Las reservas en línea no están disponibles por ahora. Llámanos.",
  INVALID_REQUEST: "No pudimos procesar la reserva. Inténtalo de nuevo.",
  NOT_FOUND: "No encontramos esta reserva.",
  NOT_CANCELLABLE: "Esta reserva ya no se puede cancelar.",
  TOO_LATE: "Falta menos de 1 hora para tu cita. Para cancelar, llámanos por teléfono.",
};

const GENERIC = "Algo salió mal. Inténtalo de nuevo en unos segundos.";

/** Extracts a known code from a Postgres/PostgREST error message. */
export function errorCode(message: string | undefined): string | null {
  if (!message) return null;
  return Object.keys(MESSAGES).find((code) => message.includes(code)) ?? null;
}

export function errorMessage(code: string | null): string {
  return (code && MESSAGES[code]) || GENERIC;
}

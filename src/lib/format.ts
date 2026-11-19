/** "56926311837" → "+56 9 2631 1837" (Chilean mobile). Other formats pass through with "+". */
export function formatPhone(digits: string): string {
  const m = /^56(9)(\d{4})(\d{4})$/.exec(digits);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`;
}

/**
 * Chilean phone → "+56XXXXXXXXX", or null if invalid. Mirrors the rule in
 * book_appointment() so admin-created appointments are stored the same way.
 */
export function normalizeChileanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^56[2-9]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^[2-9]\d{8}$/.test(digits)) return `+56${digits}`;
  return null;
}

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

/** 10000 → "$10.000" */
export function formatCLP(amount: number): string {
  return clp.format(amount);
}

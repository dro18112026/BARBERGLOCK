/** "56926311837" → "+56 9 2631 1837" (Chilean mobile). Other formats pass through with "+". */
export function formatPhone(digits: string): string {
  const m = /^56(9)(\d{4})(\d{4})$/.exec(digits);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`;
}

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

/** 10000 → "$10.000" */
export function formatCLP(amount: number): string {
  return clp.format(amount);
}

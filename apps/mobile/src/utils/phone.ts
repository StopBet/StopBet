export function formatPhone(phone: string): string {
  const m = /^\+569(\d{4})(\d{4})$/.exec(phone.replace(/\s/g, ''));
  return m ? `+56 9 ${m[1]} ${m[2]}` : phone;
}

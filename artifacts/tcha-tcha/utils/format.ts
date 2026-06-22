export function formatAmount(amount: number): string {
  return amount.toLocaleString("fr-FR").replace(/,/g, " ");
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

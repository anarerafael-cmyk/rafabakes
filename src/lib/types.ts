export type DropItem = {
  dropItemId: string;
  name: string;
  description: string;
  priceCents: number;
  allergens: string[];
  imageUrl: string | null;
  badge: string | null;
  left: number;
};

export type Drop = {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  pickupLabel: string;
  pickupLocation: string;
  pickupSlots: string[];
  items: DropItem[];
};

export type PaymentMethod = "card" | "venmo" | "zelle";

export const money = (cents: number) =>
  "$" + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

export const formatDropTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  });

export const ALLERGENS = ["wheat", "milk", "eggs", "walnuts", "pecans", "almonds", "peanuts", "soy", "sesame"];

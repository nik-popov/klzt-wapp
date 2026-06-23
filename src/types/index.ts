export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export interface Item {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  color: string | null;
  size: string | null;
  brand: string | null;
  image_key: string | null;
  times_worn: number;
  last_worn: string | null;
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: number;
  name: string;
  notes: string | null;
  items: Item[];
  created_at: string;
  updated_at: string;
}

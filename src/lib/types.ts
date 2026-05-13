export interface BakerSettings {
  id?: string;
  baker_id?: string;
  shop_name: string;
  home_address: string;
  home_lat: number | null;
  home_lng: number | null;
  daily_capacity: number;
  whatsapp_number: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  toyyibpay_secret_key?: string;
  toyyibpay_category_id?: string;
  delivery_start_time: string;
  delivery_end_time: string;
  is_setup_complete: boolean;
}

export interface DeliveryZone {
  id?: string;
  baker_id?: string;
  zone_name: string;
  min_km: number;
  max_km: number;
  fee: number;
}

export interface Product {
  id?: string;
  baker_id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  prep_time: number;
  bake_time: number;
  cool_time: number;
}

export type OrderStatus = 'pending' | 'approved' | 'production' | 'ready' | 'otw' | 'completed' | 'cancelled';
export type PaymentMethod = 'toyyibpay' | 'manual_transfer' | 'cod';
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid';

export interface Order {
  id?: string;
  baker_id?: string;
  order_number?: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_lat?: number;
  customer_lng?: number;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  delivery_fee: number;
  distance_km?: number;
  total_amount: number;
  delivery_date: string;
  delivery_time?: string;
  status: OrderStatus;
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  receipt_url?: string;
  special_notes?: string;
  created_at?: string;
}

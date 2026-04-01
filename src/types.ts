export type Role = 'admin' | 'employee';

export interface Employee {
  id: string;
  username: string;
  user_id: string;
  password?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  login_time: string | null;
  logout_time: string | null;
  total_hours: number | null;
  shift: 'day' | 'night' | null;
  katai: number | null;
  mtr_type: string | null;
  created_at: string;
  employee?: Employee; // Joined data
}

export interface Party {
  id: string;
  name: string;
  gst_no: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  gst_percent: number;
  created_at: string;
}

export interface Challan {
  id: string;
  challan_no: string;
  party_id: string;
  date: string;
  total_amount: number;
  created_at: string;
  party?: Party; // Joined data
}

export interface ChallanItem {
  id: string;
  challan_id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  total: number;
  created_at: string;
}

export interface AuthUser {
  user_id: string;
  username: string;
  role: Role;
}

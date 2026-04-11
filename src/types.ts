export type Role = 'admin' | 'employee';

export interface Employee {
  id: string;
  username: string;
  user_id: string;
  password?: string;
  hourly_rate?: number;
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
  patti_per_katay?: number | null;
  mtr_type: string | null;
  product_id?: string | null;
  machine_id?: string | null;
  remarks?: string | null;
  created_at: string;
  employee?: Employee; // Joined data
  product?: Product; // Joined data
}

export interface Party {
  id: string;
  name: string;
  gst_no: string;
  phone: string;
  address: string;
  type: 'purchase' | 'sell';
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number; // Legacy, keeping for compatibility
  base_price: number;
  bill_price: number;
  challan_price: number;
  gst_percent: number;
  gst_applicable?: boolean;
  type: 'purchase' | 'sell';
  product_mts?: number;
  patti_mts?: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  party_id: string;
  date: string;
  total_amount: number;
  created_at: string;
  party?: Party;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  created_at: string;
}

export interface Advance {
  id: string;
  employee_id: string;
  amount: number;
  date: string;
  created_at: string;
}

export interface Machine {
  id: string;
  name: string;
  created_at: string;
}

export interface Design {
  id: string;
  machine_id: string;
  name: string;
  patti_count: number;
  created_at: string;
}

export interface Production {
  id: string;
  attendance_id: string;
  product_id?: string;
  design_id?: string;
  mts: number;
  created_at: string;
}

export interface Bill {
  id: string;
  bill_no: string;
  party_id: string;
  date: string;
  gst_enabled: boolean;
  subtotal: number;
  total_gst: number;
  grand_total: number;
  total_profit: number;
  created_at: string;
  party?: Party;
}

export interface BillItem {
  id: string;
  bill_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  base_price: number;
  gst_percentage: number;
  gst_amount: number;
  total: number;
  created_at: string;
}

export interface Challan {
  id: string;
  challan_no: string;
  party_id: string;
  date: string;
  total_amount: number;
  total_profit: number;
  created_at: string;
  party?: Party; // Joined data
}

export interface ChallanItem {
  id: string;
  challan_id: string;
  product_id: string;
  product_name: string;
  price: number;
  base_price: number;
  quantity: number;
  total: number;
  created_at: string;
}

export interface AuthUser {
  user_id: string;
  username: string;
  role: Role;
}

export interface PurchasePayment {
  id: string;
  purchase_id?: string;
  party_id: string;
  amount_paid: number;
  date: string;
  created_at: string;
  party?: Party;
}

export interface SalesPayment {
  id: string;
  bill_id?: string;
  party_id: string;
  amount_received: number;
  date: string;
  created_at: string;
  party?: Party;
}

export interface SalaryPayment {
  id: string;
  employee_id: string;
  salary_amount: number;
  total_advance: number;
  final_salary: number;
  date: string;
  created_at: string;
  employee?: Employee;
}

export interface Settings {
  id: string;
  business_name: string;
  address: string;
  gst_no: string;
  phone: string;
  email: string;
  logo_url: string;
  created_at: string;
}

export interface PartyProductPrice {
  id: string;
  party_id: string;
  product_id: string;
  bill_price: number;
  challan_price: number;
  created_at: string;
  party?: Party;
  product?: Product;
}

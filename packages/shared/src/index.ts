import { z } from 'zod';
export const roles = ['ADMIN', 'DISPATCHER', 'WAREHOUSE', 'FINANCE', 'DRIVER', 'CUSTOMER'] as const;
export type Role = typeof roles[number];
export const statuses = ['BOOKED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'] as const;
export type Status = typeof statuses[number];
export const transitions: Record<Status, Status[]> = { BOOKED: ['CANCELLED'], ASSIGNED: ['PICKED_UP', 'CANCELLED'], PICKED_UP: ['IN_TRANSIT', 'FAILED'], IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'], OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'], FAILED: ['ASSIGNED', 'RETURNED'], DELIVERED: [], RETURNED: [], CANCELLED: [] };
export const services = ['STANDARD', 'EXPRESS', 'SAME_DAY'] as const;
export const loginSchema = z.object({ email: z.string().email().max(160).transform(v => v.toLowerCase()), password: z.string().min(1).max(128) });
export const registerSchema = loginSchema.extend({ name: z.string().trim().min(2).max(100), password: z.string().min(12).max(128), phone: z.string().trim().min(5).max(30) });
export const addressSchema = z.object({ address: z.string().trim().min(5).max(250), city: z.string().trim().min(2).max(100), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const bookingSchema = z.object({ pickup: addressSchema, delivery: addressSchema, recipientName: z.string().trim().min(2).max(100), recipientPhone: z.string().trim().min(5).max(30), weight: z.number().positive().max(10000), length: z.number().positive().max(1000), width: z.number().positive().max(1000), height: z.number().positive().max(1000), declaredValue: z.number().int().min(0).max(100000000), service: z.enum(services), pickupAt: z.string().datetime(), notes: z.string().max(1000).default(''), customerId: z.string().optional() });
export type Booking = z.infer<typeof bookingSchema>;
export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    phone: string;
    active: number;
    created_at: string;
}
export interface Shipment {
    id: string;
    tracking: string;
    customer_id: string;
    customer_name?: string;
    recipient_name: string;
    recipient_phone: string;
    pickup_address: string;
    pickup_city: string;
    pickup_lat: number;
    pickup_lng: number;
    delivery_address: string;
    delivery_city: string;
    delivery_lat: number;
    delivery_lng: number;
    weight: number;
    length: number;
    width: number;
    height: number;
    declared_value: number;
    service: string;
    status: Status;
    price: number;
    distance: number;
    notes: string;
    pickup_at: string;
    due_at: string;
    driver_id: string | null;
    driver_name?: string;
    vehicle_id: string | null;
    plate?: string;
    created_at: string;
    updated_at: string;
    version: number;
    proof_name: string | null;
    proof_note: string | null;
    delivered_at: string | null;
}
export interface Invoice {
    id: string;
    number: string;
    shipment_id: string;
    customer_id: string;
    customer_name?: string;
    tracking?: string;
    amount: number;
    paid: number;
    status: string;
    created_at: string;
}
export interface Vehicle {
    id: string;
    plate: string;
    model: string;
    capacity: number;
    status: string;
    odometer: number;
    service_due: string;
    created_at: string;
}
export interface Hub {
    id: string;
    name: string;
    city: string;
    address: string;
    capacity: number;
    occupancy: number;
}
export interface Ticket {
    id: string;
    subject: string;
    customer_id: string;
    customer_name?: string;
    shipment_id: string | null;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string;
}
export interface Rate {
    service: string;
    base: number;
    per_km: number;
    per_kg: number;
    multiplier: number;
    sla_hours: number;
}
export interface Quote {
    amount: number;
    distance: number;
    billableWeight: number;
    base: number;
    distanceFee: number;
    weightFee: number;
    insurance: number;
    slaHours: number;
    currency: string;
}
export const money = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
export const human = (s: string) => s.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

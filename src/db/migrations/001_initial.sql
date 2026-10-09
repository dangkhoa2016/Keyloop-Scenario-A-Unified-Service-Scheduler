
CREATE TABLE IF NOT EXISTS dealerships(id TEXT PRIMARY KEY,name TEXT NOT NULL,time_zone TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)));
CREATE TABLE IF NOT EXISTS dealership_hours(dealership_id TEXT NOT NULL REFERENCES dealerships(id),weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),open_minute INTEGER NOT NULL,close_minute INTEGER NOT NULL,CHECK(open_minute>=0 AND close_minute<=1440 AND open_minute<close_minute),PRIMARY KEY(dealership_id,weekday));
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,display_name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vehicles(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),vin TEXT NOT NULL UNIQUE,make TEXT NOT NULL,model TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS service_types(id TEXT PRIMARY KEY,name TEXT NOT NULL,duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0 AND duration_minutes<=480),active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS skills(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS service_type_skills(service_type_id TEXT NOT NULL REFERENCES service_types(id),skill_id TEXT NOT NULL REFERENCES skills(id),PRIMARY KEY(service_type_id,skill_id));
CREATE TABLE IF NOT EXISTS technicians(id TEXT PRIMARY KEY,dealership_id TEXT NOT NULL REFERENCES dealerships(id),name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS technician_skills(technician_id TEXT NOT NULL REFERENCES technicians(id),skill_id TEXT NOT NULL REFERENCES skills(id),PRIMARY KEY(technician_id,skill_id));
CREATE TABLE IF NOT EXISTS technician_shifts(technician_id TEXT NOT NULL REFERENCES technicians(id),weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),start_minute INTEGER NOT NULL,end_minute INTEGER NOT NULL,CHECK(start_minute>=0 AND end_minute<=1440 AND end_minute>start_minute),PRIMARY KEY(technician_id,weekday,start_minute));
CREATE TABLE IF NOT EXISTS technician_blackouts(id TEXT PRIMARY KEY,technician_id TEXT NOT NULL REFERENCES technicians(id),start_at_ms INTEGER NOT NULL,end_at_ms INTEGER NOT NULL,CHECK(end_at_ms>start_at_ms));
CREATE TABLE IF NOT EXISTS service_bays(id TEXT PRIMARY KEY,dealership_id TEXT NOT NULL REFERENCES dealerships(id),name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS bay_service_types(bay_id TEXT NOT NULL REFERENCES service_bays(id),service_type_id TEXT NOT NULL REFERENCES service_types(id),PRIMARY KEY(bay_id,service_type_id));
CREATE TABLE IF NOT EXISTS bay_blackouts(id TEXT PRIMARY KEY,bay_id TEXT NOT NULL REFERENCES service_bays(id),start_at_ms INTEGER NOT NULL,end_at_ms INTEGER NOT NULL,CHECK(end_at_ms>start_at_ms));
CREATE TABLE IF NOT EXISTS appointments(
 id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
 dealership_id TEXT NOT NULL REFERENCES dealerships(id),service_type_id TEXT NOT NULL REFERENCES service_types(id),
 technician_id TEXT NOT NULL REFERENCES technicians(id),service_bay_id TEXT NOT NULL REFERENCES service_bays(id),
 start_at_ms INTEGER NOT NULL,end_at_ms INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN('confirmed','cancelled')),
 idempotency_key TEXT NOT NULL UNIQUE,request_fingerprint TEXT NOT NULL,created_at_ms INTEGER NOT NULL,
 CHECK(end_at_ms>start_at_ms)
);
CREATE INDEX IF NOT EXISTS idx_appointments_tech ON appointments(technician_id,start_at_ms,end_at_ms) WHERE status='confirmed';
CREATE INDEX IF NOT EXISTS idx_appointments_bay ON appointments(service_bay_id,start_at_ms,end_at_ms) WHERE status='confirmed';
CREATE INDEX IF NOT EXISTS idx_appointments_dealer ON appointments(dealership_id,start_at_ms);
CREATE TRIGGER IF NOT EXISTS appointment_guard_insert BEFORE INSERT ON appointments WHEN NEW.status='confirmed'
BEGIN
SELECT RAISE(ABORT,'TECHNICIAN_OVERLAP') WHERE EXISTS(SELECT 1 FROM appointments a WHERE a.status='confirmed' AND a.technician_id=NEW.technician_id AND a.start_at_ms<NEW.end_at_ms AND NEW.start_at_ms<a.end_at_ms);
SELECT RAISE(ABORT,'SERVICE_BAY_OVERLAP') WHERE EXISTS(SELECT 1 FROM appointments a WHERE a.status='confirmed' AND a.service_bay_id=NEW.service_bay_id AND a.start_at_ms<NEW.end_at_ms AND NEW.start_at_ms<a.end_at_ms);
END;
CREATE TRIGGER IF NOT EXISTS appointment_guard_update BEFORE UPDATE ON appointments WHEN NEW.status='confirmed'
BEGIN
SELECT RAISE(ABORT,'TECHNICIAN_OVERLAP') WHERE EXISTS(SELECT 1 FROM appointments a WHERE a.id<>NEW.id AND a.status='confirmed' AND a.technician_id=NEW.technician_id AND a.start_at_ms<NEW.end_at_ms AND NEW.start_at_ms<a.end_at_ms);
SELECT RAISE(ABORT,'SERVICE_BAY_OVERLAP') WHERE EXISTS(SELECT 1 FROM appointments a WHERE a.id<>NEW.id AND a.status='confirmed' AND a.service_bay_id=NEW.service_bay_id AND a.start_at_ms<NEW.end_at_ms AND NEW.start_at_ms<a.end_at_ms);
END;

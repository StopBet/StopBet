import psycopg2
conn = psycopg2.connect("postgresql://postgres:password@localhost:5432/stopbet")
cur = conn.cursor()
cur.execute("SELECT id, status FROM panic_alerts ORDER BY \"createdAt\" DESC")
print("Todas las alertas:", cur.fetchall())
cur.execute("UPDATE panic_alerts SET status = 'cancelled' WHERE status IN ('pending','responded','escalated')")
print("Canceladas:", cur.rowcount)
conn.commit()
conn.close()

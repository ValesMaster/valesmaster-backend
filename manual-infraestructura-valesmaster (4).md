# Manual de Infraestructura — Proyecto Pastelito / ValesMaster

> Este documento resume la arquitectura actual, las direcciones IP, los comandos usados y lo que falta por hacer.
---

## 1. Resumen general de la arquitectura

El proyecto corre en **DigitalOcean**, con droplets en **Rocky Linux 9**, conectados entre sí por una **VPN privada (WireGuard)**. La idea central es:

- Nadie puede entrar por SSH a ningún droplet si la VPN está apagada — es un requisito explícito del profesor.
- El único punto de entrada público a la aplicación es el **Load Balancer**, vía Cloudflare.
- Dentro de la VPN, el único droplet que acepta SSH directo desde tu laptop es el **bastión** (`s1`). De ahí, saltas a cualquier otro droplet.

```
Internet ──► Cloudflare ──► Load Balancer (s3) ──► Apps (s2, app2, app3) ──► Bases de Datos (maestro, vm-esclavo)
                                                                                       │
Tu laptop ──► VPN (vm-vpn) ──► Bastión SSH (s1) ──► (salto SSH) ──► Cualquier droplet
```

---

## 2. Droplets — qué es cada uno

| Nombre | Rol | ¿Para qué sirve? |
|---|---|---|
| `vm-vpn` | Servidor VPN (WireGuard) | Es la "puerta" de la VPN. Sin este droplet encendido y con WireGuard activo, nadie puede entrar por SSH a ningún otro droplet. |
| `s1` | Bastión SSH | Es el ÚNICO droplet al que tu laptop puede conectarse por SSH directamente. Desde aquí saltas a los demás. |
| `s3` | Load Balancer (LB) | Recibe TODO el tráfico público (HTTPS) y lo reparte entre los 3 droplets de App. Aquí vive nginx con la configuración de `upstream`. |
| `s2` | App 1 (Frontend + Backend) | Corre el frontend (Next.js, puerto 3000) y el backend/API (Node/Express, puerto 4000). |
| `app2` | App 2 (Frontend + Backend) | Igual que `s2`. |
| `app3` | App 3 (Frontend + Backend) | Igual que `s2`. |
| `maestro` | Base de datos primaria | Corre Postgres (puerto 54329) y Mongo (puerto 53465). Aquí se escribe. |
| `vm-esclavo` | Base de datos réplica | Copia en tiempo real de `maestro` (Postgres streaming + Mongo replica set). Aquí solo se lee. |
| `vm-storage` | Almacenamiento (backups) | Comparte almacenamiento con las Apps vía NFS (puerto 2049). |
| App del compañero | Externa, fuera de nuestra administración | Está en el `upstream` del LB pero NO está en nuestra VPN — usa su IP pública directamente. |

---

## 3. Direcciones IP


| Dispositivo | IP VPN (WireGuard) — ACTUAL | Puerto SSH |
|---|---|---|
| `vm-vpn` (servidor) | 192.168.10.1 | — (no aplica, es el servidor VPN) |
| Laptop del admin | 192.168.10.2 | — |
| `s1` (bastión) | 192.168.10.3 | 54632 |
| `s2` (App 1) | 192.168.10.4 | 54632 (solo accesible desde `s1`) |
| `s3` (Load Balancer) | 192.168.10.5 | 54632 (solo accesible desde `s1`) |
| `maestro` (BD primaria) | 192.168.10.6 | 54632 (solo accesible desde `s1`) |
| `vm-esclavo` (BD réplica) | 192.168.10.7 | 54632 (solo accesible desde `s1`) |
| `app2` (App 2) | 192.168.10.8 | 54632 (solo accesible desde `s1`) |
| `app3` (App 3) | 192.168.10.9 | 54632 (solo accesible desde `s1`) |
| `vm-storage` | 192.168.10.10 | 54632 (solo accesible desde `s1`) |

**Puertos de servicio (no confundir con el puerto SSH):**

| Servicio | Puerto | Dónde corre |
|---|---|---|
| Postgres | 54329 | `maestro`, `vm-esclavo` |
| MongoDB (TLS) | 53465 | `maestro`, `vm-esclavo` |
| Backend/API (Express) | 4000 | `s2`, `app2`, `app3` |
| Frontend (Next.js, vía PM2) | 3000 | `s2`, `app2`, `app3` |
| NFS (storage) | 2049 | `vm-storage` |
| WireGuard (UDP) | 53239 | `vm-vpn` |

---

## 4. Cómo conectarse (flujo real de acceso)

1. Activa tu cliente WireGuard en tu laptop (interfaz apuntando a `vm-vpn`).
2. Conéctate por SSH al bastión:
   ```
   ssh -p 54632 sandia@192.168.10.3
   ```
   Te va a pedir: llave privada (passphrase) → password de `sandia` → código OTP (Google Authenticator).
3. **Desde dentro de `s1`**, salta a cualquier otro droplet:
   ```
   ssh -p 54632 sandia@192.168.10.X
   ```
   (reemplaza `X` según la tabla de arriba). Esto solo funciona si tienes **"Allow agent forwarding"** activado en tu cliente SSH (en PuTTY: Connection → SSH → Auth) y tu llave cargada en Pageant — así tu laptop "presta" la llave a través de `s1` sin que quede copiada ahí.

**Regla de seguridad:** ningún droplet (excepto `s1`) acepta SSH desde ninguna otra IP que no sea `192.168.10.3` (la de `s1`). Esto está reforzado en el firewall de cada droplet, no solo en teoría.

---

## 5. Usuarios en cada droplet

- **`sandia`** — sin privilegios de administrador, es el único usuario que puede iniciar sesión SSH.
- **`naranja`** — con privilegios (`sudo`/`wheel`), es dueño de las carpetas de la aplicación (frontend/backend).

---

## 6. Firewall (`firewalld`) — cómo está organizado

Cada droplet tiene varias **zonas** (piensa en una zona como un "grupo de reglas" atado a una interfaz de red específica):

| Zona | Interfaz | Para qué |
|---|---|---|
| `public` | `eth0` | Tráfico de internet real (IP pública del droplet). |
| `vpn` | `wg0` | Tráfico que viene por la VPN de WireGuard. **Aquí viven las reglas más importantes.** |
| `internal` | `eth1` | Red interna de DigitalOcean (VPC), no la usamos activamente para el acceso. |

### Patrón de reglas en la zona `vpn` (en todos los droplets excepto `s1` y `vm-vpn`):

```
rule priority="-20" source address="192.168.10.3/32" port port="54632" protocol="tcp" accept   ← permite SSH SOLO desde s1
rule priority="-10" port port="54632" protocol="tcp" reject                                    ← rechaza SSH de cualquier otra IP
```
(Las prioridades más bajas se evalúan primero — por eso el "accept" para `s1` va antes que el "reject" general.)

### Comandos útiles de firewall:

```bash
# Ver en qué zona vive cada interfaz
sudo firewall-cmd --get-active-zones

# Ver todas las reglas de la zona vpn
sudo firewall-cmd --zone=vpn --list-all

# Agregar una regla rica (ejemplo: permitir un puerto solo desde una IP)
sudo firewall-cmd --zone=vpn --add-rich-rule='rule family="ipv4" source address="192.168.10.X" port port="PUERTO" protocol="tcp" accept' --permanent

# Aplicar cambios permanentes
sudo firewall-cmd --reload
```

⚠️ **Siempre usa `--permanent` y después `--reload`** — si no, el cambio se pierde al reiniciar el droplet.

---

## 7. Load Balancer (`s3`) — nginx

Archivo de configuración: `/etc/nginx/conf.d/laravel.conf`

**Qué hace:**
- Recibe HTTPS con certificado de origen de Cloudflare.
- Detecta la IP real del visitante usando los rangos de Cloudflare (`set_real_ip_from`).
- Reparte tráfico según la ruta:

| Ruta | A dónde va | Upstream |
|---|---|---|
| `/api/*` (desde VPN) | Backend, vía IP interna | `api_vpn` → `192.168.10.4:80` |
| `/api/*` (público) | Backend, balanceado con `ip_hash` | `api_public` → `192.168.10.4:80`, `192.168.10.8:80` |
| `/mobile/*` | Backend, apps móviles | `mobile_apps` → puerto 3001 en `s2`/`app2`/`app3` |
| `/tablet/*` | Backend, apps de tablet | `tablet_apps` → puerto 3002 en `s2`/`app2`/`app3` |
| `/` (todo lo demás) | Frontend | `frontend_app3` → `192.168.10.9:80` |

**Comandos útiles:**
```bash
sudo nginx -t                      # probar sintaxis antes de aplicar
sudo systemctl reload nginx        # aplicar cambios sin cortar conexiones activas
sudo tail -f /var/log/nginx/balance.log   # ver peticiones en tiempo real, incluye a qué droplet fue cada una
```

⚠️ **Importante (corregido el 26/ago/2026):** el puerto `443/tcp` (HTTPS) y `80/tcp` deben estar abiertos en la zona **`public`** de `s3` (no solo en `vpn`), o el tráfico externo real nunca llega a nginx. Si algún día "nadie puede entrar a la página" mientras el LB está encendido, **revisa primero esto**:
```bash
sudo firewall-cmd --zone=public --list-all
```

---

## 8. Bases de datos

### Postgres (puerto 54329)
- `maestro` = primario. `vm-esclavo` = réplica de solo lectura (streaming replication).
- Usuario de la app: `manzana` (mínimo privilegio). Usuario de solo lectura: `limon`. Usuario de replicación: `replicator`.
- Config de acceso: `/var/lib/pgsql/16/data/pg_hba.conf` en `maestro`.

**Comandos útiles:**
```bash
# Conectar (usa el puerto custom, no el 5432 default)
sudo -u postgres psql -p 54329

# Ver estado de la replicación (correr en maestro)
sudo -u postgres psql -p 54329 -c "SELECT client_addr, state FROM pg_stat_replication;"

# Aplicar cambios de config sin reiniciar
sudo -u postgres psql -p 54329 -c "SELECT pg_reload_conf();"
```

### MongoDB (puerto 53465, TLS obligatorio)
- Corre en Docker (`mongo-master` en `maestro`, `mongo-esclavo` en `vm-esclavo`).
- Replica set llamado `rs0`.
- Usuario de la app: `manzana_mongo` (mínimo privilegio, solo en la base `valesmaster`).
- Certificados TLS: en el host están en `/opt/mongo/certs/`, pero **dentro del contenedor la ruta es `/etc/mongo/`** — no lo confundas al conectar.

**Comandos útiles:**
```bash
# Conectar a mongo dentro del contenedor
docker exec -it mongo-master mongosh --tls --tlsCertificateKeyFile /etc/mongo/mongo.pem --tlsCAFile /etc/mongo/mongo.crt -u admin_mongo -p --authenticationDatabase admin

# Ver estado del replica set
rs.status()

# Cambiar la IP de un miembro del replica set (si algún día cambia la subred de nuevo)
var cfg = rs.conf()
cfg.members[0].host = "NUEVA_IP:53465"
cfg.version++
rs.reconfig(cfg)   # agrega {force: true} si el set no puede elegir primario por sí mismo
```

---

## 9. Backends (Node/Express) — `.env` y PM2

Cada droplet App tiene su propio `.env` con las cadenas de conexión a las bases de datos. **Si cambia la IP de `maestro`/`vm-esclavo`, hay que actualizar el `.env` en LOS TRES droplets** (`s2`, `app2`, `app3`).

Rutas del repo backend:
- `s2`: `/home/naranja/valesmaster-backend`
- `app2`: `/opt/valesmaster-backend`
- `app3`: `/home/naranja/proyectos/valesmaster-backend`

**⚠️ Lección aprendida:** si editas el `.env` mientras el backend ya lleva tiempo corriendo, un simple `pm2 restart` **no siempre recarga bien las variables** (el proceso puede quedarse con conexiones viejas cacheadas en memoria). Si ves errores raros después de editar el `.env`, haz esto en vez de solo `restart`:

```bash
pm2 delete vales-backend
pm2 start npm --name "vales-backend" -- start
pm2 save
```

**Comandos generales de PM2:**
```bash
pm2 list                                   # ver todos los procesos
pm2 logs vales-backend --lines 30 --nostream   # ver los últimos logs sin quedarse "pegado"
pm2 flush vales-backend                    # limpiar logs viejos (útil antes de una prueba)
pm2 restart vales-backend --update-env     # reinicia intentando tomar el .env nuevo
```

**Prueba rápida de que el backend responde:**
```bash
curl http://localhost:4000/
```

---

## 10. Comandos de referencia rápida (cheatsheet)

```bash
# --- Diagnosticar por qué algo no conecta ---
sudo firewall-cmd --get-active-zones              # ¿en qué zona vive la interfaz?
sudo firewall-cmd --zone=NOMBRE --list-all         # ¿qué reglas tiene esa zona?
sudo grep -n -A1 "Match Address" /etc/ssh/sshd_config   # ¿sshd restringe por subred?
sudo wg show                                       # ¿WireGuard tiene handshake reciente?
ping -c 4 IP_DESTINO                               # ¿hay conectividad de red básica?

# --- Capturar tráfico para ver qué está pasando de verdad ---
sudo timeout 20 tcpdump -i wg0 -n "port PUERTO or icmp"

# --- Reemplazo masivo de una IP vieja por una nueva en un archivo ---
sudo cp archivo.conf archivo.conf.bak-$(date +%Y%m%d)   # SIEMPRE respalda primero
sudo sed -i 's/IP_VIEJA/IP_NUEVA/g' archivo.conf
```





# /home/docker/pve_dashboard/Dockerfile
FROM php:8.2-apache

# Benötigte Pakete installieren (SQLite + OpenSSL für Zertifikate + Cron für den Scheduler)
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    openssl \
    cron \
    && docker-php-ext-install pdo_sqlite

# Apache Rewrite-Modul (für schöne URLs) und SSL-Modul aktivieren
RUN a2enmod rewrite ssl

# Generiere ein Self-Signed Zertifikat (Gültig für 10 Jahre)
RUN openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/private/apache-selfsigned.key \
    -out /etc/ssl/certs/apache-selfsigned.crt \
    -subj "/C=DE/ST=Brandenburg/L=Gruenheide/O=PUC/OU=IT/CN=localhost"

# Passe die Default SSL Konfiguration an
RUN sed -i 's/ssl-cert-snakeoil.pem/apache-selfsigned.crt/g' /etc/apache2/sites-available/default-ssl.conf \
    && sed -i 's/ssl-cert-snakeoil.key/apache-selfsigned.key/g' /etc/apache2/sites-available/default-ssl.conf

# SSL Site in Apache aktivieren
RUN a2ensite default-ssl.conf

# Cronjob einrichten (Ruft die cron.php minütlich auf und leitet Output ins Docker-Log um)
RUN echo "* * * * * root /usr/local/bin/php /var/www/html/cron.php > /proc/1/fd/1 2>/proc/1/fd/2\n" >> /etc/crontab

# Beide Ports freigeben
EXPOSE 80
EXPOSE 443

# Startbefehl: Startet erst den Cron-Daemon im Hintergrund und dann Apache im Vordergrund
CMD cron && apache2-foreground
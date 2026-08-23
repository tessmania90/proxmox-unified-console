FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    openssl \
    cron \
    && docker-php-ext-install pdo_sqlite

RUN a2enmod rewrite ssl

RUN openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/private/apache-selfsigned.key \
    -out /etc/ssl/certs/apache-selfsigned.crt \
    -subj "/C=DE/ST=Brandenburg/L=Gruenheide/O=PUC/OU=IT/CN=localhost"

RUN sed -i 's/ssl-cert-snakeoil.pem/apache-selfsigned.crt/g' /etc/apache2/sites-available/default-ssl.conf \
    && sed -i 's/ssl-cert-snakeoil.key/apache-selfsigned.key/g' /etc/apache2/sites-available/default-ssl.conf

RUN a2ensite default-ssl.conf

COPY ./src /var/www/html/
RUN chown -R www-data:www-data /var/www/html/

# Der goldene Fix für die Datenbankrechte!
RUN mkdir -p /var/www/data && chown -R www-data:www-data /var/www/data

RUN echo "* * * * * root /usr/local/bin/php /var/www/html/cron.php > /proc/1/fd/1 2>/proc/1/fd/2\n" >> /etc/crontab

EXPOSE 80
EXPOSE 443

CMD cron && apache2-foreground
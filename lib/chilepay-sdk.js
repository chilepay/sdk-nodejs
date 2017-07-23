"use strict";

const crypto = require('crypto');
const https = require('https');
const url = require('url');
const qs = require('querystring');

const API_VERSION = 'dev';

/**
 * @typedef {object} MetaDataElement
 *
 * @property {string|undefined} type - El tipo de dato. Por omisión es 'text'. Valores válidos:
 *  - text: para texto.
 *      Codificado como string.
 *  - email: para email.
 *      Codificado como string.
 *  - phone: para número de teléfono.
 *      Codificado como string.
 *  - link: para link.
 *      Codificado como string.
 *  - date: para fechas.
 *      Codificado como string. Usar formato yyyy-mm-dd
 *      Ejemplo: 1989-11-08
 *  - time: Para tiempo (hora).
 *      Codificado como string. Usar formato hh:mm:ss, formato de 24 horas.
 *      Ejemplo: 09:12:58
 *  - datetime: para fecha y hora
 *      Codificado como string. Formato yyyy-mm-ddThh:mm:ss (ISO 8601)
 *      Ejemplo: 1989-11-08T09:11:58
 *  - documentId: para el folio de algún documento, por RUT, número de pasaporte, etc.
 *      Codificado como string
 *      Puede ir junto con .documentType para detallar si es RUT, pasaporte u otro.
 *      Ejemplo:
 *  - number: para un número albitrario.
 *      Codificado como number.
 *      Puede ir en conjunto con .currency o .unit
 *  - list: para lista de elementos.
 *      Codificado como un array.
 *      Ejemplo: [ 'Zapallo', 'Mono' ]
 *  - table: para estructuras de detalle.
 *      Codificado como un array de arrays (una matriz), en donde cada arreglo es una fila. La primera fila siempre
 *      es el encabezado.
 *      Ejemplo:
 *      [
 *          [ 'Ítem', 'Valor unitario', 'Cantidad', 'Sub Total' ],
 *          [ 'Pilas AAAA4', 1500, 2, 3000 ],
 *          [ 'Shampoo Champú', 2500, 1, 2500 ]
 *      ]
 *      Notar que el máximo de filas y columnas es indeterminado. La cantidad de columnas debe ser igual pora
 *      todas las filas, incluyendo el encabezado.
 *
 * @property {string} name - Un rótulo que acompaña al dato, por ejemplo "Nombre"
 *
 * @property {*} value - El valor, codificado según type.
 *
 * Los siguientes atributos son opcionales según .type
 * @property {string|undefined} currency - Solo si .type es 'number', opcional. Usar para indicar que el número es un
 * monto monetario. El valor es el tipo de divisa según la ISO 4217.
 * Por ejemplo, 'CLP' es 'Peso chileno', 'CLF' es UF (Unidad de Fomento, Chile), 'USD' para doólar estadounidense, etc.
 * Si la divisa no tiene un código ISO, usar lo más cercano posible, por ejemplo: 'BTC' para Bitcoin.
 *
 * @property {string|undefined} unit - Solo si .type es 'nuber', opcional.
 * Usar para indicar la unidad de lo que sea que exprese el número, por ejemplo:
 * - u: unidades
 * - l: litros
 * - kg: kilográmos
 * etc. No hay valores predefinidos.
 *
 */

class Chilepay {

    /**
     *
     * @param {string} apiKey
     * @param {string} secretKey
     */
    constructor(apiKey, secretKey) {
        if(!apiKey || !secretKey) {
            throw new Error('apiKey and/or secretKey are missing');
        }
        this.apiKey = apiKey;
        this.secretKey = secretKey;
    }

    getFees(plan) {
        return this.get('fees', {
            plan: plan || 'a'
        });
    }

    /**
     *
     * - - - - - - Los siguientes son los parámetros OBLIGATORIOS para iniciar la transacción - - - - - -
     *
     * @param {string} provider el proveedor de pasarelas de pago que deseas que Chilepay use en la transacción.
     * Las opciones son:
     * - webpay:
     *      - Para cobro en tarjetas de débito y crédito bancarias en Chile. Operado por Transbank.
     *      - Divisas soportadas: clp
     * - khipu:
     *      - Para cobro en transferencias bancarias de banos chilenos. Operado por Khipu.
     *      - Divisas soportadas: clp
     *      - Adicionalmente a paymentUrl, retorna paymentSimplifiedTransferUrl (pasarela simplificada de Khipu) y
     *        paymentTransferUrl (pasarela de transferencia normal de Khipu).
     *
     * @param params
     *
     * @param {string} params.subject descripción breve sobre el asunto de esta transacción. Texto libre.
     * Máximo 80 carácteres.
     *
     * @param {string} params.buyerEmail el email de quien está pagando. No es necesario que este
     * email corresponda a una cuenta de Chilepay. Si el pago se realiza de forma exitosa se le enviará el comprobante
     * a este email. Máximo 100 carácteres.
     *
     * @param {string} params.currency divisa usada en la transacción. Todos los montos de la transacción se entenderán
     * en esta divisa. Valores posibles:
     * - clp: Para pesos chilenos. Máximo de decimales: 0
     *
     * @param {number} params.amount el monto a pagar. La cantidad mínima y máxima depende del plan contratado.
     *
     * @param {string} params.notifyUrl URL en que Chilepay realizará una petición y esperará el acuse de recibo para
     * confirmar la transacción. Máximo 255 carácteres.
     *
     * @param {string} params.returnUrl URL hacia donde Chilepay redirigirá al usuario una vez completada la
     * transacción (independiente de si la transacción fue exitosa). Máximo 255 carácteres.
     *
     * - - - - - - Los siguientes parámetros son OPCIONALES, pero recomendables para mejorar la usabilidad - - - - - -
     *
     * @param {...MetaDataElement?} params.metadata Array con información adicional sobre la transacción.
     * Esta información quedará asociada a esta transacción, y será mostrada en la GUI de Chilepay al consultar los
     * detalles de esta, tanto por el Comprador como por el Vendedor.
     * Además, será enviada junto con el comprobante de pago por email al comprador.
     * No hay máximo definido, pero se recomienda que en total no supere los 140Kb.
     *
     * @param {string?} params.selfUrl URL que apunta a los detalles de esta transacción dentro de tu aplicación. Se
     * mostrará en la GUI de Vendedor Chilepay. Máximo 255 carácteres.
     *
     * @param {string?} params.groupId identificador del grupo al que pertenece esta transacción, según la lógica de tu
     * aplicación. Por ejemplo, si quieres agrupar todas las transacciones sobre la compra de un artículo en tu tienda,
     * entonces pon el ID del artículo. De esta forma, el usuario podrá buscar todas las transacciones de tal artículo
     * por su ID. Máximo 40 carácteres.
     *
     * @param {string?} params.groupUrl URL que apunta a los detalles del grupo al que pertenece esta transacción,
     * según la lógica de tu aplicación. Se mostrá en la GUI de Vendedor Chilepay. Máximo 255 carácteres.
     *
     * @param {string?} params.theme El tema visual en el que se mostrará el resultado del proveedor de
     * pagos (antes de dirigir a returnUrl). Por omisión es themeBlue
     * Temas disponibles:
     * - themeRed
     * - themePink
     * - themePurple
     * - themeDeepPurple
     * - themeIndigo
     * - themeBlue
     * - themeLightBlue
     * - themeCyan
     * - themeTeal
     * - themeGreen
     * - themeLime
     * - themeOrange
     * - themeBrown
     * - themeGrayYellow
     * - themeGrayBlue
     *
     * - - - - - - Los siguientes parámetros son obligatorios solo si tu aplicación es reseller - - - - - -
     *
     * @param {object?} params.reseller
     *
     * @param {string?} params.reseller.sellerAccountId identificador de la cuenta de quién es el vendedor en esta
     * transacción. Recuerda que debes poseer la autorización del vendedor para que tu aplicación venda en su nombre,
     * usando el método cp.initAuth({scopes}). Obligatorio si la transacción es reseller.
     *
     * @param {number?} params.reseller.feePercent El porcentaje de comisión que se le descontarás al vendedor por esta
     * transacción (.params.amount es el 100%), adicionalmente a la comisión de Chilepay.
     * Este dinero irá hacia tu cuenta. El mínimo es 0, el máximo es el que te autorizó el vendedor (si te autorizo 3%,
     * entonces el máximo es 3).
     * Obligatorio si la transacción es reseller (si no deseas cobrar esta comisión, indica 0).
     * Máximo de decimales: 4
     * Esta comisión es sumativa a tu favor con params.reseller.feeFixed
     *
     * @param {number?} params.reseller.feeFixed El monto fijo (en la divisa de la transacción) que le descontarás al
     * vendedor para esta transacción, adicional a la comisión de Chilepay.
     * Este dinero irá hacia tu cuenta. El mínimo es 0, el máximo es el que te autorizó el vendedor (en la divisa de
     * la transacción).
     * Obligatorio si la transacción es reseller (si no deseas cobrar esta comisión, indica 0).
     * Máximo de decimales: Según defina la divisa en .params.currency
     * Esta comisión es sumativa a tu favor con params.reseller.feePercent
     *
     * - - - - - - Los siguientes parámetros son opcionales, úsalos si es que te son útiles - - - - - -
     *
     * @param {string?} params.trackerToken token de esta transacción según la lógica de tu aplicación. No sobreescribe al
     * atributo .transactionId de la transacción (asignado por Chilepay). Lo recuperarás cada vez que llames a
     * cp.getTransaction(transactionId). Máximo 26 caracteres.
     *
     * @param {string?} params.mode determina el modo en que se hará la transacción. Usualmente debes ignorar esto.
     * Opciones posibles:
     * - ss: "Server Side" (valor por defecto). Indica que la transacción se realiza por el lado del servidor.
     * - cs: "Client Side" Usar solo si la transaccion se sigue realizando por el lado del servidor (más que mal,
     * tu secretKey jamás de los jamáses debe estar en el cliente), pero la transacción es iniciada por el plugin
     * Javascript SDK de Chilapay.
     *
     * @returns {Promise<{
     * transactionId, paymentUrl
     * }>}
     */
    initTransaction(provider, params) {
        if(typeof provider !== 'string') {
            return Promise.reject(new Error('provider is missing'));
        }
        if(typeof params !== 'object') {
            return Promise.reject(new Error('initTransactionInput object parameter missing'));
        }
        return this.post('transactions/' + provider, params);
    }

    /**
     *
     * @param {string} transactionId
     * @returns {*}
     */
    getTransaction(transactionId) {
        return this.get('transactions/' + transactionId);
    }

    /**
     *
     * @param params
     *
     * @param {string?} params.trackerToken
     *
     * @param {string?} params.notifyUrl URL en donde te notificaremos si el usuario aceptó. Max 255 carácteres.
     * Es obligatorio si .mode es 'ss'.
     *
     * @param {string?} params.returnUrl URL hacia adonde dirigir al usuario al terminar. Max 255 carácteres.
     * Es obligatorio si .mode es 'ss'.
     *
     * @param params.scopes un objeto en donde cada clave representa un permiso a solicitar.
     *
     * @param {boolean} params.scopes.additionalInfo true para obtener información adicional de la cuenta del usuario.
     * Por defecto solo se informa el id de la cuenta del usuario. Información adicional:
     *  - name: El nombre de la cuenta del usuario.
     *  - email: El email de la cuenta del usuario.
     *  - activeServices: El nombre de los servicios que el usuario tiene activos ('comprador', 'vendedor', 'desarrollador')
     *  Falso o no definir para caso contrario. Usar solo si es realmente necesario.
     *
     * @param {object} params.scopes.reseller definir si deseas venden en nombre del usuario (usando su cuenta Vendedor).
     *
     * @param {float} params.scopes.reseller.maxFeePercent porcentaje de comisión máxima. Mínimo 0.
     * Notar que 0.1 es 0.1%, y 10 es 10%. No puede superar el límite permitido para tu cuenta.
     *
     * @param {number} params.scopes.reseller.maxFeeFixedClp monto fijo en pesos chilenos que solicitas como comisión
     *
     * @param {{string:boolean}?} params.scopes.reseller.providers un objeto con los proveedores de transacciones
     * electrónicas que deseas solicitar. Al menos indicar uno. Si se ignora se usará { all: true }
     *
     * @param {boolean?} params.scopes.reseller.providers.webpay true para solicitar webpay
     * @param {boolean?} params.scopes.reseller.providers.khipu true para solicitar khipu
     * @param {boolean?} params.scopes.reseller.providers.all true para solicitar todos los anteriores
     *
     * @param {object} params.scopes.receiveMoney solicitas autorización para realizar transferencias desde tu cuenta
     * hacia la del usuario. NO DISPONIBLE PARA ESTA VERSIÓN.
     *
     */
    initAuth(params) {
        return this.post('auth', initAuthInput);
    }


    /**
     *
     *
     * @param accountId
     */
    getAccount(accountId) {
        return this.get('accounts/' + accountId);
    }

    /**
     *
     * @param url
     * @param params
     * @returns {*}
     */
    get(url, params) {
        return this._request('get', url, params)
    }

    /**
     *
     * @param url
     * @param params
     * @returns {*}
     */
    post(url, params) {
        return this._request('post', url, params)
    }

    /**
     *
     * @param url
     * @param params
     * @returns {*}
     */
    put(url, params) {
        return this._request('put', url, params)
    }

    /**
     *
     * @param url
     * @param params
     * @returns {*}
     */
    delete(url, params) {
        return this._request('delete', url, params)
    }

    _request(method, url, params) {
        method = method.toUpperCase();
        let jwt = Chilepay._jwtCreate({
            type: 'api'
        }, 60 * 3 /* 3 minutes*/, this.secretKey);

        params = params || {};
        let queryString, body;

        if(method === 'GET') {
            queryString = qs.stringify(params);
            body = '';
        } else {
            body = JSON.stringify(params);
        }

        return new Promise((resolve, reject) => {

            const req = https.request({
                protocol: 'https:',
                hostname: 'api.chilepay.cl',
                port: null,
                method: method.toUpperCase(),
                path: '/' + API_VERSION + '/' + url + (queryString ? '?' + queryString : ''),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + jwt,
                    'x-api-key': this.apiKey
                }
            }, (res) => {

                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    let responseBody = JSON.parse(Buffer.concat(chunks).toString());
                    if (res.statusCode < 200 || res.statusCode > 299) {
                        reject(responseBody);
                    } else {
                        resolve(responseBody);
                    }
                });

            });

            req.on('error', (err) => reject(err));

            req.write(body);
            req.end();

        });

    }

    static _jwtCreate(payload, expireIn, secretKey) {
        let header = {
            alg: 'HS256',
            typ: 'JWT'
        };
        let iat = Date.now() / 1000;
        Object.assign(payload, {
            iat: iat,
            exp: iat + expireIn
        });
        let tokenHeader = Chilepay._base64UrlEncode(header);
        let tokenPayload = Chilepay._base64UrlEncode(payload);
        let signature = crypto.createHmac('sha256', secretKey)
            .update(tokenHeader + '.' + tokenPayload)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        return tokenHeader + '.' + tokenPayload + '.' + signature;
    }

    static _base64UrlEncode(object) {
        return (new Buffer(JSON.stringify(object)).toString('base64'))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

}

module.exports = Chilepay;
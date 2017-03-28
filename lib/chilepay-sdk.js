"use strict";

const request = require('request-promise-native');
const crypto = require('crypto');

const API_URL = 'https://api.chilepay.cl';
const API_VERSION = 'dev';

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
     * @param initTransactionInput
     *
     * @param {string} initTransactionInput.type la pasarela de pago a usar. Valores posibles:
     * - 'webpay' : Para pagos con tarjetas de crédito y débito bancarias con WebPay
     * - 'khipu' : Para pagos con transferencias bancarias con Khipu
     *
     * @param {string} initTransactionInput.buyerEmail el email de quien está pagando. No es necesario que este
     * email corresponda a una cuenta de Chilepay. Si el pago se realiza de forma exitosa se le enviará el comprobante
     * a este email. Máximo 256 carácteres.
     *
     * @param {number} initTransactionInput.amount el monto de la transacción. Si initTransactionInput.currency
     * es 'CLP', entonces debe ser un número entero (sino será rechazada).
     *
     * @param {string} initTransactionInput.currency la moneda de la transacción. Valores posibles:
     * - 'clp': para pesos chilenos. Esta divisa no usa decimales.
     *
     * @param {string} initTransactionInput.urlNotify la url en la que chilepay te notificará cuando el pago sea
     * procesado por la pasarela de pagos.
     *
     * @param {string} initTransactionInput.urlReturn la url hacia donde redirigir al usuario al terminar la
     * transacción
     *
     * @param {object?} initTransactionInput.reseller Solo si actúas como reseller (es decir, estás vendiendo en el
     * "nombre" de alguien más), en caso contrario omitir.
     *
     * @param {string} initTransactionInput.reseller.sellerAccountId el ID de de la cuenta vendedor.
     * El vendedor debe autorizarte con anterioridad para que vendas en su nombre, usando el método initAuth con el scope
     * 'reseller'.
     *
     * @param {number} initTransactionInput.reseller.feePerc porcentaje de comisión que reclamas para ti como
     * desarrollador por cada venta. No puede superar el porcentaje autorizado por el vendedor
     * initTransactionInput.reseller.sellerAccountId, al usar el método initAuth. Mínimo 0.
     *
     * @param {number} initTransactionInput.reseller.feeClf parte fija de comisión en UF que reclamas para tí como
     * desarrollador por cada venta. No puede superar el monto autorizado por el vendedor
     * initTransactionInput.reseller.sellerAccountId, al usar el método initAuth. Mínimo 0. Máximo 4 decimales.
     *
     * @returns {Promise<{transactionId, urlRedirection}>}
     */
    initTransaction(initTransactionInput) {
        if(typeof initTransactionInput !== 'object') {
            return Promise.reject(new Error('initTransactionInput object parameter missing'));
        }
        return this.post('transactions', initTransactionInput);
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
     * @param {string|{seed}} transactionSeed si es string entonces debes indicar el atributo seed del objeto
     * transaction (devuelto por .getTransaction(transactionId)).
     * También puedes usar el objeto transaction directamente.
     * @return {XML|string|void|*}
     */
    makeNotificationResponse(transactionSeed) {
        transactionSeed = transactionSeed.seed || transactionSeed;
        return crypto.createHash('sha256')
            .update(transactionSeed + this.secretKey)
            .digest('base64')
            .replace(/=/g, '');
    }

    /**
     *
     * @param initAuthInput.urlResponseNotify
     *
     * @param initAuthInput.scope
     *
     * @param {boolean} initAuthInput.scope.additionalInfo true para obtener información adicional de la cuenta del usuario:
     *  - id: El ID de la cuenta del usuario.
     *  - name: El nombre de la cuenta del usuario.
     *  - email: El email de la cuenta del usuario.
     *  - activeServices: Los servicios que el usuario tiene activos ('COMPRADOR', 'VENDEDOR', 'DESARROLLADOR')
     *  Falso o no definir para caso contrario. Usar solo si es realmente necesario.
     *
     * @param {object} initAuthInput.scope.reseller definir si deseas venden en nombre del usuario (usando su cuenta Vendedor).
     *
     * @param {float} initAuthInput.reseller.feePerc porcentaje de comisión que reclamas para tí como
     * desarrollador por cada venta. No puede superar el porcentaje autorizado por el vendedor.
     *
     * @param {number} initAuthInput.reseller.feeClf.
     *
     */
    initAuth(initAuthInput) {
        return this.post('auth', initAuthInput);
    }


    /**
     *
     *
     * @param accountId
     */
    getAuthAccount(accountId) {
        return this.get('auth/' + accountId);
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

        let jwt = Chilepay._jwtCreate({
            sub: this.apiKey,
            type: 'api'
        }, 60 * 3 /* 3 minutes*/, this.secretKey);

        params = params || {};
        let qs = {}, body = {};

        if(method.toLowerCase() === 'get') {
            qs = params;
        } else {
            body = params;
        }

        return request({
            method: method,
            uri: API_URL + '/' + API_VERSION + '/' + url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwt,
                'x-api-key': this.apiKey
            },
            qs: qs,
            body: body,
            json: true
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
            .replace('=', '');

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
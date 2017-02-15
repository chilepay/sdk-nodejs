"use strict";

const request = require('request-promise-native');
const settings = require('./settings');

class Chilepay {

    /**
     *
     * @param props
     * @param props.publicKey
     * @param props.privateKey
     */
    constructor(props) {
        if(!props || !props.publicKey || !props.privateKey) {
            throw new Error('Invalid arguments, need publicKey or privateKey');
        }
        this.publicKey = props.publicKey;
        this.privateKey = props.privateKey;
    }

    createTransaction(params) {
        return this.post('transactions', params);
    }

    getTransaction(params) {
        return this.get('transactions', params);
    }

    get(url, params) {
        return this._request('get', url, params)
    }

    post(url, params) {
        return this._request('post', url, params)
    }

    put(url, params) {
        return this._request('put', url, params)
    }

    delete(url, params) {
        return this._request('delete', url, params)
    }

    _request(method, url, params) {
        let jwt = '';
        return request({
            method: method,
            uri: settings.URL_API + url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwt
            },
            body: params || {},
            json: true
        });
    }

}

module.exports = Chilepay;
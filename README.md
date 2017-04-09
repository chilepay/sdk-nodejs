# chilepay-sdk

> **Warning:** In active development. Not ready for production usage.

Kit de integración para la API de Chilepay con node.js.

## Instalación

`npm install chilepay-sdk`

## Modo de uso

```javascript
const ChilePay = require('chilepay-sdk');

let cp = new ChilePay("{apiKey}", "{secretKey}");

```

Para obtener tu `{apiKey}` y `{secretKey}` debes activar Desarrollador Chilepay

### Crear una transacción

1. Inicia la transacción y redirecciona al usuario a la url retornada por Chilepay.

```javascript
cp.initTransaction({
    using: 'webpay',
    amount: 10000,
    currency: 'clp',
    buyerEmail: 'comprador@example.com',
    urlNotify: 'https://example.com/notificacion',
    urlReturn: 'https://example.com/tienda'
}).then((response) => {
    res.redirect(response.urlRedirection);
});
```

2. Al recibir la notificación, llama a `.getTransaction("{token}")` para obtener 
la información de la transacción. Posteriormente retorna tu firma con 
`.makeNotificationResponse(transaction)`

```javascript
// en https://example.com/notificacion

let transactionId = req.params.transactionId;

cp.getTransaction(transactionId).then((transaction) => {
    
    // Aquí debes fijarte en transaction.status, si es "preApproved" entonces
    // debes actualizar tu base de datos y disminuir stock. La transacción
    // se considerará aprobada solo si retornas tu firma.
    
    let notificationResponse = cp.makeNotificationResponse(transaction);
    
    res.send(notificationResponse);
    
});
```

Apache-2 License.
var crypto = require('crypto');


function decrypt_des(cipher, key) {
    var key = new Buffer(key);
    var iv = new Buffer(0);
    var ciph = cipher;
    var alg = 'des-ede3';
    var autoPad = true;

    //decrypt  
    var decipher = crypto.createDecipheriv(alg, key, iv);
    decipher.setAutoPadding(autoPad)
    var txt = decipher.update(ciph, 'base64', 'utf8');
    txt += decipher.final('utf8');
    return txt;
}

function encrypt_des(plaintext, key) {
    var key = new Buffer(key);
    var iv = new Buffer(0);
    var alg = 'des-ede3';
    var autoPad = true;

    var cipher = crypto.createCipheriv(alg, key, iv);
    cipher.setAutoPadding(autoPad)  //default true  
    var ciph = cipher.update(plaintext, 'utf8', 'base64');
    ciph += cipher.final('base64');
    return ciph;

}

exports.decrypt_des = decrypt_des;
exports.encrypt_des = encrypt_des;

// @ts-nocheck
/* COPIED FROM CLIENT BUNDLE (MANUAL SYNC) */
// https://raw.githubusercontent.com/jjavery/ed25519-to-x25519/main/src/ed2curve.js
// @ts-nocheck
import crypto from 'crypto';
// If an 'initialValues' argument is provided, the values of the 'initialValues' array will be assigned to the new 'result' array
const gf = function (initialValues) {
    // Declare variables 'index' and 'result'
    const result = new Float64Array(16);
    // If an 'initialValues' argument is provided
    if (initialValues) {
        // Loop through the 'initialValues' array
        for (let index = 0; index < initialValues.length; index++) {
            // Assign the value of the 'initialValues' array at the current index to the corresponding index in the 'result' array
            result[index] = initialValues[index];
        }
    }
    // Return the new 'result' array
    return (result);
};
const gf0 = gf();
const gf1 = gf([1]);
const D = gf([
    0x78a3,
    0x1359,
    0x4dca,
    0x75eb,
    0xd8ab,
    0x4141,
    0x0a4d,
    0x0070,
    0xe898,
    0x7779,
    0x4079,
    0x8cc7,
    0xfe73,
    0x2b6f,
    0x6cee,
    0x5203
]);
const I = gf([
    0xa0b0,
    0x4a0e,
    0x1b27,
    0xc4ee,
    0xe478,
    0xad2f,
    0x1806,
    0x2f43,
    0xd7a7,
    0x3dfb,
    0x0099,
    0x2b4d,
    0xdf0b,
    0x4fc1,
    0x2480,
    0x2b83
]);
// This function is used to perform some operations on an array 'o' of 16 elements
// It adds 65536 to each element,  perform a floor division by 65536,
// and based on the result of floor division it will make some additional calculations
function car25519(inputArray) {
    let carryOverValue;
    // Loop through each element of the array
    for (let index = 0; index < 16; index++) {
        // Add 65536 to the current element
        inputArray[index] += 65536;
        // Perform a floor division by 65536 and assign the result to 'carryOverValue'
        carryOverValue = Math.floor(inputArray[index] / 65536);
        // If current index is not the last element of the array
        if (index < 15) {
            inputArray[index + 1] += carryOverValue - 1;
        }
        else {
            inputArray[0] += carryOverValue - 1 + 37 * (carryOverValue - 1);
        }
        // Subtract the product of 'carryOverValue' and 65536 from the current element
        inputArray[index] -= (carryOverValue * 65536);
    }
}
// This function takes three arguments: two arrays 'p' and 'q' of length 16 and a variable 'b'
// It performs a selection operation on the elements of the 'p' and 'q' based on the value of 'b'
function sel25519(array1, array2, b) {
    const comparison = ~(b - 1);
    let temp;
    // Loop through each element of the array
    for (let index = 0; index < 16; index++) {
        temp = comparison & (array1[index] ^ array2[index]);
        array1[index] ^= temp;
        array2[index] ^= temp;
    }
}
/**
 * This function unpacks bytes into 16-bit integers in order to perform operations on them with maximum precision.
 * Since JavaScript numbers are 64-bit floating-point numbers and they can't accurately represent integers larger than 2^53,
 * unpacking bytes into 16-bit integers provides a way to work with larger integers without losing precision.
 *
 * @param output the array of integers to store the unpacked values
 * @param inputBytes the input bytes array to unpack
 */
function unpack25519(output, inputBytes) {
    // iterate over the first 16 element of inputBytes
    for (let i = 0; i < 16; i++) {
        // output at i is inputBytes at 2i plus inputBytes at 2i+1 shifted 8 bit to the left ( this is equivalent of combining 2 bytes)
        output[i] = inputBytes[2 * i] + (inputBytes[2 * i + 1] << 8);
    }
    // Zeroing the most significant bit of last element
    output[15] &= 0x7fff;
}
/**
 * This function performs the addition of two arrays and stores the result in the output array
 *
 * @param output the array to store the result
 * @param a first array to add
 * @param b second array to add
 */
function A(output, a, b) {
    for (let i = 0; i < 16; i++) {
        output[i] = a[i] + b[i] | 0;
    }
}
/**
* This function performs the subtraction of two arrays and stores the result in the output array
*
* @param output the array to store the result
* @param a first array
* @param b second array to subtract from the first
*/
function Z(output, a, b) {
    for (let i = 0; i < 16; i++) {
        output[i] = a[i] - b[i] | 0;
    }
}
/**
 * This function performs the multiplication of two arrays and stores the result in the output array.
 *
 * @param output the array to store the result
 * @param a first array
 * @param b second array
 */
function M(output, a, b) {
    const temp = new Float64Array(31);
    // initialize temp array to zero
    for (let i = 0; i < 31; i++) {
        temp[i] = 0;
    }
    // perform the multiplication of a and b
    for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) {
            temp[i + j] += a[i] * b[j];
        }
    }
    // add 38 times the higher order coefficients to the lower order ones
    for (let i = 0; i < 15; i++) {
        temp[i] += 38 * temp[i + 16];
    }
    // copy the temp array to output array
    for (let i = 0; i < 16; i++) {
        output[i] = temp[i];
    }
    // perform two car25519 operation on output array
    car25519(output);
    car25519(output);
}
// squaring
function S(o, a) {
    M(o, a, a);
}
/**
 * This function calculates the modular inverse of the input array and stores it in the output array.
 *
 * @param output the array to store the result
 * @param inputArray the input array
 */
function inv25519(output, inputArray) {
    const c = gf();
    let a;
    // copy the input array to c
    for (a = 0; a < 16; a++) {
        c[a] = inputArray[a];
    }
    // perform the modular inverse calculation
    for (a = 253; a >= 0; a--) {
        S(c, c);
        if (a !== 2 && a !== 4) {
            M(c, c, inputArray);
        }
    }
    // copy the result to output
    for (a = 0; a < 16; a++) {
        output[a] = c[a];
    }
}
/**
 * This function packs a 16-bit integers array into bytes array
 *
 * @param outputBytes the array of bytes to store the packed values
 * @param inputIntegers the input integers array to pack
 */
function pack25519(outputBytes, inputIntegers) {
    let i, j, carryBit;
    const tempArray = gf();
    const resultArray = gf();
    // copy input array to resultArray
    for (i = 0; i < 16; i++) {
        resultArray[i] = inputIntegers[i];
    }
    // perform car25519 operation on resultArray
    car25519(resultArray);
    car25519(resultArray);
    car25519(resultArray);
    for (j = 0; j < 2; j++) {
        tempArray[0] = resultArray[0] - 0xffed;
        for (i = 1; i < 15; i++) {
            tempArray[i] = resultArray[i] - 0xffff - ((tempArray[i - 1] >> 16) & 1);
            tempArray[i - 1] &= 0xffff;
        }
        tempArray[15] = resultArray[15] - 0x7fff - ((tempArray[14] >> 16) & 1);
        carryBit = (tempArray[15] >> 16) & 1;
        tempArray[14] &= 0xffff;
        // perform sel25519 operation on resultArray
        sel25519(resultArray, tempArray, 1 - carryBit);
    }
    // pack the resultArray into outputBytes
    for (i = 0; i < 16; i++) {
        outputBytes[2 * i] = resultArray[i] & 0xff;
        outputBytes[2 * i + 1] = resultArray[i] >> 8;
    }
}
/**
 * This function checks if the least significant bit of the packed bytes representation of a number is set.
 *
 * @param inputInteger the number to check
 * @returns 1 if the least significant bit is set, 0 otherwise
 */
function par25519(inputInteger) {
    const packedBytes = new Uint8Array(32);
    pack25519(packedBytes, [inputInteger]);
    return (packedBytes[0] & 1);
}
/**
 * This function compares two arrays for equality.
 *
 * @param x the first array to compare
 * @param xi the starting index of the first array
 * @param y the second array to compare
 * @param yi the starting index of the second array
 * @param n the number of elements to compare
 * @returns 0 if the arrays are equal, -1 otherwise
 */
function vn(x, xi, y, yi, n) {
    for (let i = 0; i < n; i++) {
        if (x[xi + i] !== y[yi + i]) {
            return (-1);
        }
    }
    return (0);
}
/**
* This function compares two arrays of 16-bit integers for equality, after they have been packed into bytes.
*
* @param a the first array to compare
* @param b the second array to compare
* @returns 0 if the arrays are equal, -1 otherwise
*/
function neq25519(a, b) {
    const packedA = new Uint8Array(32), packedB = new Uint8Array(32);
    pack25519(packedA, a);
    pack25519(packedB, b);
    return (vn(packedA, 0, packedB, 0, 32));
}
function pow2523(o, i) {
    const c = gf();
    let a;
    for (a = 0; a < 16; a++) {
        c[a] = i[a];
    }
    for (a = 250; a >= 0; a--) {
        S(c, c);
        if (a !== 1) {
            M(c, c, i);
        }
    }
    for (a = 0; a < 16; a++) {
        o[a] = c[a];
    }
}
function set25519(r, a) {
    for (let i = 0; i < 16; i++) {
        r[i] = a[i] | 0;
    }
}
/**
 * Ensure a key is valid
 */
function unpackNeg(r, p) {
    // Initialize local variables
    const t = gf();
    const chk = gf();
    const num = gf();
    const den = gf();
    const den2 = gf();
    const den4 = gf();
    const den6 = gf();
    // Set the value of the third element in the 'r' array to 'gf1'
    set25519(r[2], gf1);
    // Unpack the values of the 'p' array and assign them to the second element of the 'r' array
    unpack25519(r[1], p);
    // Squaring the value of the second element of the 'r' array and assigns the result to 'num'
    S(num, r[1]);
    // Multiply the value of 'num' by the constant 'D' and assigns the result to 'den'
    M(den, num, D);
    // Add the values of 'num' and the third element of the 'r' array and assigns the result to 'num'
    Z(num, num, r[2]);
    // Add the values of 'den' and the third element of the 'r' array and assigns the result to 'den'
    A(den, r[2], den);
    // Squaring the value of 'den' and assigns the result to 'den2'
    S(den2, den);
    // Squaring the value of 'den2' and assigns the result to 'den4'
    S(den4, den2);
    // Multiply the values of 'den4' and 'den2' and assigns the result to 'den6'
    M(den6, den4, den2);
    // Multiply the values of 't', 'den6', 'num' and 'den'
    M(t, den6, num);
    M(t, t, den);
    // Raise the value of 't' to the power of 2523
    pow2523(t, t);
    // Multiply the values of 't', 'num' and 'den'
    M(t, t, num);
    M(t, t, den);
    M(t, t, den);
    // Assign the value of 't' to the first element of the 'r' array
    M(r[0], t, den);
    // Squaring the value of the first element of the 'r' array and assigns the result to 'chk'
    S(chk, r[0]);
    M(chk, chk, den);
    // Check if the value of 'chk' is equal to the value of 'num'
    if (neq25519(chk, num)) {
        // If not, multiply the first element of the 'r' array by the constant 'I'
        M(r[0], r[0], I);
    }
    // Squaring the value of the first element of the 'r' array and assigns the result to 'chk'
    S(chk, r[0]);
    M(chk, chk, den);
    // Check if the value of 'chk' is equal to the value of 'num'
    if (neq25519(chk, num)) {
        return (-1);
    }
    // Check if the parity of the first element of the 'r' array is equal to the most significant bit of the 32nd element of the 'p' array
    if (par25519(r[0]) === (p[31] >> 7)) {
        // If so, subtract the first element of the 'r' array from 'gf0' and assigns the result to the first element of the 'r' array
        Z(r[0], gf0, r[0]);
    }
    // Multiply the first and second element of the 'r' array and assign the result to the fourth element of the 'r' array
    M(r[3], r[0], r[1]);
    return (0);
}
// ----
// Converts Ed25519 public key to Curve25519 public key.
// montgomeryX = (edwardsY + 1)*inverse(1 - edwardsY) mod p
function convertPublicKey(pk) {
    const z = new Uint8Array(32);
    const q = [gf(), gf(), gf(), gf()];
    const a = gf(), b = gf();
    // reject invalid key
    if (unpackNeg(q, pk)) {
        return (null);
    }
    A(a, gf1, q[1]);
    Z(b, gf1, q[1]);
    inv25519(b, b);
    M(a, a, b);
    pack25519(z, a);
    return (z);
}
// Converts Ed25519 secret key to Curve25519 secret key.
function convertSecretKey(sk) {
    const o = new Uint8Array(32);
    const hash = crypto.createHash('sha512');
    hash.update(sk);
    const digest = hash.digest();
    digest[0] &= 248;
    digest[31] &= 127;
    digest[31] |= 64;
    for (let i = 0; i < 32; i++) {
        o[i] = digest[i];
    }
    return (o);
}

export { convertPublicKey, convertSecretKey };
const ed2curve = { convertSecretKey, convertPublicKey };
export default ed2curve;

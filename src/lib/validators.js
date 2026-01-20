
export const validateCPF = (cpf) => {
    cpf = cpf.replace(/[^\d]+/g, '')
    if (cpf === '' || cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false

    let add = 0
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i)
    let rev = 11 - (add % 11)
    if (rev === 10 || rev === 11) rev = 0
    if (rev !== parseInt(cpf.charAt(9))) return false

    add = 0
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i)
    rev = 11 - (add % 11)
    if (rev === 10 || rev === 11) rev = 0
    if (rev !== parseInt(cpf.charAt(10))) return false

    return true
}

export const validateCNPJ = (cnpj) => {
    cnpj = cnpj.replace(/[^\d]+/g, '')
    if (cnpj === '' || cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false

    let size = cnpj.length - 2
    let numbers = cnpj.substring(0, size)
    let digits = cnpj.substring(size)
    let sum = 0
    let pos = size - 7
    for (let i = size; i >= 1; i--) {
        sum += numbers.charAt(size - i) * pos--
        if (pos < 2) pos = 9
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (result !== parseInt(digits.charAt(0))) return false

    size = size + 1
    numbers = cnpj.substring(0, size)
    sum = 0
    pos = size - 7
    for (let i = size; i >= 1; i--) {
        sum += numbers.charAt(size - i) * pos--
        if (pos < 2) pos = 9
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    if (result !== parseInt(digits.charAt(1))) return false

    return true
}

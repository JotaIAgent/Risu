
export const translateAuthError = (message) => {
    if (!message) return null

    const errors = {
        'Email not confirmed': 'O seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.',
        'Invalid login credentials': 'Email ou senha incorretos.',
        'User already registered': 'Este e-mail já está cadastrado.',
        'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
        'Invalid email address': 'Formato de e-mail inválido.',
        'Signup disabled': 'O cadastro de novos usuários está temporariamente desativado.',
        'Email rate limit exceeded': 'Muitas tentativas de envio de e-mail. Tente novamente mais tarde.',
        'Too many requests': 'Muitas solicitações simultâneas. Tente novamente em alguns minutos.'
    }

    // Try an exact match first, then a partial match
    if (errors[message]) return errors[message]

    for (const key in errors) {
        if (message.toLowerCase().includes(key.toLowerCase())) {
            return errors[key]
        }
    }

    return message // Return original if no match found
}

// "https://www.Facebook.com/inicio?x=1" -> "facebook.com"
export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
}

export const isValidDomain = (domain: string): boolean => /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)

// Un dominio coincide con otro si es igual o es un subdominio suyo ("a.facebook.com" coincide con "facebook.com").
export const matchesDomain = (domain: string, rule: string): boolean => domain === rule || domain.endsWith('.' + rule)

def number_to_words_inr(amount: float | int) -> str:
    """
    Converts a numeric amount into Indian Currency text format.
    Example: 38100 -> 'Thirty-Eight Thousand One Hundred Rupees Only'
    """
    amount = int(round(amount))
    if amount == 0:
        return "Zero Rupees Only"

    units = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    ]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def convert_two_digits(n: int) -> str:
        if n < 20:
            return units[n]
        rem = n % 10
        t = tens[n // 10]
        return f"{t}-{units[rem]}" if rem else t

    def convert_three_digits(n: int) -> str:
        res = ""
        hundreds = n // 100
        rem = n % 100
        if hundreds:
            res += f"{units[hundreds]} Hundred"
            if rem:
                res += " and "
        if rem:
            res += convert_two_digits(rem)
        return res

    words = []
    crores = amount // 10000000
    amount %= 10000000
    if crores:
        words.append(f"{convert_two_digits(crores)} Crore")

    lakhs = amount // 100000
    amount %= 100000
    if lakhs:
        words.append(f"{convert_two_digits(lakhs)} Lakh")

    thousands = amount // 1000
    amount %= 1000
    if thousands:
        words.append(f"{convert_two_digits(thousands)} Thousand")

    if amount:
        words.append(convert_three_digits(amount))

    return " ".join(words).strip() + " Rupees Only"

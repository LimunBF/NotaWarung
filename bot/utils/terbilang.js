const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
const belasan = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 
                 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];

export function numberToWords(num) {
  if (num === 0) return 'nol rupiah';
  
  let result = convertToWords(num);
  return result.trim() + ' rupiah';
}

function convertToWords(num) {
  if (num === 0) return '';
  if (num < 10) return satuan[num];
  if (num < 20) return belasan[num - 10];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return satuan[tens] + ' puluh' + (ones > 0 ? ' ' + satuan[ones] : '');
  }
  if (num < 200) {
    const remainder = num % 100;
    return 'seratus' + (remainder > 0 ? ' ' + convertToWords(remainder) : '');
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    return satuan[hundreds] + ' ratus' + (remainder > 0 ? ' ' + convertToWords(remainder) : '');
  }
  if (num < 2000) {
    const remainder = num % 1000;
    return 'seribu' + (remainder > 0 ? ' ' + convertToWords(remainder) : '');
  }
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return convertToWords(thousands) + ' ribu' + (remainder > 0 ? ' ' + convertToWords(remainder) : '');
  }
  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    return convertToWords(millions) + ' juta' + (remainder > 0 ? ' ' + convertToWords(remainder) : '');
  }
  
  // Untuk angka lebih besar (milyar, dst)
  const billions = Math.floor(num / 1000000000);
  const remainder = num % 1000000000;
  return convertToWords(billions) + ' milyar' + (remainder > 0 ? ' ' + convertToWords(remainder) : '');
}

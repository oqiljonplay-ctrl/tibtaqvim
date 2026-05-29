// O'zbekiston viloyatlari va tumanlari
export interface UzDistrict {
  name: string;
}
export interface UzRegion {
  name: string;
  districts: string[];
}

export const UZ_REGIONS: UzRegion[] = [
  {
    name: "Toshkent shahri",
    districts: [
      "Bektemir tumani", "Chilonzor tumani", "Hamza tumani", "Mirobod tumani",
      "Mirzo Ulug'bek tumani", "Olmazor tumani", "Sergeli tumani", "Shayxontohur tumani",
      "Uchtepa tumani", "Yakkasaroy tumani", "Yunusobod tumani", "Yashnobod tumani",
    ],
  },
  {
    name: "Toshkent viloyati",
    districts: [
      "Angren shahri", "Bekobod shahri", "Bo'ka tumani", "Bo'stonliq tumani",
      "Chinoz tumani", "Chirchiq shahri", "Ohangaron tumani", "Oqqo'rg'on tumani",
      "Parkent tumani", "Piskent tumani", "Qibray tumani", "Toshkent tumani",
      "Yangiyo'l tumani", "Yuqorichirchiq tumani", "Zangiota tumani", "Zangiot tumani",
    ],
  },
  {
    name: "Andijon viloyati",
    districts: [
      "Andijon shahri", "Asaka tumani", "Baliqchi tumani", "Bo'z tumani",
      "Buloqboshi tumani", "Izboskan tumani", "Jalaquduq tumani", "Keltamov tumani",
      "Marhamat tumani", "Oltinko'l tumani", "Paxtaobod tumani", "Qo'rg'ontepa tumani",
      "Shahrixon tumani", "Ulug'nor tumani", "Xo'jaobod tumani",
    ],
  },
  {
    name: "Farg'ona viloyati",
    districts: [
      "Farg'ona shahri", "Bag'dod tumani", "Beshariq tumani", "Buvayda tumani",
      "Dang'ara tumani", "Furqat tumani", "Hamza tumani", "Marg'ilon shahri",
      "Oltiariq tumani", "Quva tumani", "Qo'qon shahri", "Rishton tumani",
      "So'x tumani", "Toshloq tumani", "Uchko'prik tumani", "O'zbekiston tumani",
      "Yozyovon tumani",
    ],
  },
  {
    name: "Namangan viloyati",
    districts: [
      "Namangan shahri", "Chortoq tumani", "Chust tumani", "Kosonsoy tumani",
      "Mingbuloq tumani", "Namangan tumani", "Norin tumani", "Pop tumani",
      "To'raqo'rg'on tumani", "Uchqo'rg'on tumani", "Yangiqo'rg'on tumani",
    ],
  },
  {
    name: "Samarqand viloyati",
    districts: [
      "Samarqand shahri", "Bulung'ur tumani", "Ishtixon tumani", "Jomboy tumani",
      "Kattaqo'rg'on shahri", "Narpay tumani", "Nurobod tumani", "Oqdaryo tumani",
      "Paxtachi tumani", "Payariq tumani", "Qo'shrabot tumani", "Samarqand tumani",
      "Toyloq tumani", "Urgut tumani",
    ],
  },
  {
    name: "Buxoro viloyati",
    districts: [
      "Buxoro shahri", "Buxoro tumani", "G'ijduvon tumani", "Jondor tumani",
      "Kogon shahri", "Olot tumani", "Peshku tumani", "Qorako'l tumani",
      "Qorovulbozor tumani", "Romitan tumani", "Shofirkon tumani", "Vobkent tumani",
    ],
  },
  {
    name: "Navoiy viloyati",
    districts: [
      "Navoiy shahri", "Karmana tumani", "Konimex tumani", "Navbahor tumani",
      "Nurota tumani", "Qiziltepa tumani", "Tomdi tumani", "Uchquduq tumani",
      "Xatirchi tumani",
    ],
  },
  {
    name: "Qashqadaryo viloyati",
    districts: [
      "Qarshi shahri", "Chiroqchi tumani", "Dehqonobod tumani", "G'uzor tumani",
      "Kasbi tumani", "Kitob tumani", "Koson tumani", "Mirishkor tumani",
      "Muborak tumani", "Nishon tumani", "Qarshi tumani", "Qamashi tumani",
      "Shahrisabz tumani", "Yakkabog' tumani",
    ],
  },
  {
    name: "Surxondaryo viloyati",
    districts: [
      "Termiz shahri", "Angor tumani", "Bandixon tumani", "Boysun tumani",
      "Denov tumani", "Jarqo'rg'on tumani", "Muzrabot tumani", "Oltinsoy tumani",
      "Qiziriq tumani", "Qumqo'rg'on tumani", "Sariosiyo tumani", "Sherobod tumani",
      "Shurchi tumani", "Termiz tumani", "Uzun tumani",
    ],
  },
  {
    name: "Jizzax viloyati",
    districts: [
      "Jizzax shahri", "Arnasoy tumani", "Baxmal tumani", "Do'stlik tumani",
      "Forish tumani", "G'allaorol tumani", "Sharof Rashidov tumani", "Mirzacho'l tumani",
      "Paxtakor tumani", "Yangiobod tumani", "Zafarobod tumani", "Zarbdor tumani",
      "Zomin tumani",
    ],
  },
  {
    name: "Sirdaryo viloyati",
    districts: [
      "Guliston shahri", "Boyovut tumani", "Gurlen tumani", "Mirzaobod tumani",
      "Oqoltin tumani", "Sardoba tumani", "Sayxunobod tumani", "Sirdaryo tumani",
      "Xovos tumani",
    ],
  },
  {
    name: "Xorazm viloyati",
    districts: [
      "Urganch shahri", "Bog'ot tumani", "Gurlan tumani", "Xiva tumani",
      "Xonqa tumani", "Qo'shko'pir tumani", "Shovot tumani", "Tuproqqal'a tumani",
      "Urganch tumani", "Yangiariq tumani", "Yangibozor tumani",
    ],
  },
  {
    name: "Qoraqalpog'iston Respublikasi",
    districts: [
      "Nukus shahri", "Amudaryo tumani", "Beruniy tumani", "Chimboy tumani",
      "Ellikkala tumani", "Kegeyli tumani", "Mo'ynoq tumani", "Nukus tumani",
      "Qanliko'l tumani", "Qo'ng'irot tumani", "Qorao'zak tumani", "Shumanay tumani",
      "Taxtako'pir tumani", "To'rtko'l tumani", "Xo'jayli tumani",
    ],
  },
];

export function getDistricts(regionName: string): string[] {
  return UZ_REGIONS.find((r) => r.name === regionName)?.districts ?? [];
}

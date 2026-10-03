import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// state_or_region was filled from memory. Please verify before launch:
// "Is your celebrity from Lagos?" depends on it. null = fill in yourself.
// Add more celebrities by appending objects. `id` must be unique.
// `image` can be a URL or path once you have photos you're licensed to use.

export const CELEBRITIES = [
  // MUSIC
  { id: 'burna-boy', name: 'Burna Boy', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Rivers', image: null },
  { id: 'wizkid', name: 'Wizkid', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'davido', name: 'Davido', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Osun', image: null },
  { id: 'tiwa-savage', name: 'Tiwa Savage', category: 'Music', profession: 'Musician', gender: 'female', state_or_region: 'Lagos', image: null },
  { id: 'yemi-alade', name: 'Yemi Alade', category: 'Music', profession: 'Musician', gender: 'female', state_or_region: 'Abia', image: null },
  { id: 'rema', name: 'Rema', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Edo', image: null },
  { id: 'tems', name: 'Tems', category: 'Music', profession: 'Musician', gender: 'female', state_or_region: 'Lagos', image: null },
  { id: 'asake', name: 'Asake', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Ogun', image: null },
  { id: 'olamide', name: 'Olamide', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'fireboy-dml', name: 'Fireboy DML', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Ogun', image: null },
  { id: 'adekunle-gold', name: 'Adekunle Gold', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Ogun', image: null },
  { id: 'phyno', name: 'Phyno', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Enugu', image: null },
  { id: 'flavour', name: 'Flavour', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Enugu', image: null },
  { id: 'kizz-daniel', name: 'Kizz Daniel', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Ogun', image: null },
  { id: 'ayra-starr', name: 'Ayra Starr', category: 'Music', profession: 'Musician', gender: 'female', state_or_region: 'Lagos', image: null },

  // NOLLYWOOD
  { id: 'genevieve-nnaji', name: 'Genevieve Nnaji', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Imo', image: null },
  { id: 'funke-akindele', name: 'Funke Akindele', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Lagos', image: null },
  { id: 'ramsey-nouah', name: 'Ramsey Nouah', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'richard-mofe-damijo', name: 'Richard Mofe-Damijo', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: 'Delta', image: null },
  { id: 'toyin-abraham', name: 'Toyin Abraham', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Ogun', image: null },
  { id: 'ini-edo', name: 'Ini Edo', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Akwa Ibom', image: null },
  { id: 'mercy-johnson', name: 'Mercy Johnson', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Kogi', image: null },
  { id: 'kunle-remi', name: 'Kunle Remi', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: null, image: null },
  { id: 'osita-iheme', name: 'Osita Iheme', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: 'Imo', image: null },
  { id: 'chinedu-ikedieze', name: 'Chinedu Ikedieze', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: 'Imo', image: null },

  // COMEDY
  { id: 'basketmouth', name: 'Basketmouth', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: 'Bayelsa', image: null },
  { id: 'bovi', name: 'Bovi', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: 'Delta', image: null },
  { id: 'ay-makun', name: 'AY Makun', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: 'Delta', image: null },
  { id: 'sabinus', name: 'Sabinus', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: null, image: null },
  { id: 'mr-macaroni', name: 'Mr Macaroni', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: null, image: null },
  { id: 'broda-shaggi', name: 'Broda Shaggi', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: null, image: null },

  // SPORTS
  { id: 'victor-osimhen', name: 'Victor Osimhen', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'victor-moses', name: 'Victor Moses', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'kelechi-iheanacho', name: 'Kelechi Iheanacho', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Imo', image: null },
  { id: 'alex-iwobi', name: 'Alex Iwobi', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'asisat-oshoala', name: 'Asisat Oshoala', category: 'Sports', profession: 'Footballer', gender: 'female', state_or_region: 'Lagos', image: null },
  { id: 'anthony-joshua', name: 'Anthony Joshua', category: 'Sports', profession: 'Boxer', gender: 'male', state_or_region: 'UK (diaspora)', image: null },

  // MEDIA / ENTERTAINMENT
  { id: 'ebuka-obi-uchendu', name: 'Ebuka Obi-Uchendu', category: 'Media', profession: 'TV Host', gender: 'male', state_or_region: 'Anambra', image: null },
  { id: 'toke-makinwa', name: 'Toke Makinwa', category: 'Media', profession: 'TV Host', gender: 'female', state_or_region: 'Lagos', image: null },
  { id: 'ik-osakioduwa', name: 'IK Osakioduwa', category: 'Media', profession: 'TV Host', gender: 'male', state_or_region: 'Edo', image: null },

  // ---- more MUSIC ----
  { id: 'simi', name: 'Simi', category: 'Music', profession: 'Musician', gender: 'female', state_or_region: 'Lagos', image: null },
  { id: 'omah-lay', name: 'Omah Lay', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Rivers', image: null },
  { id: 'joeboy', name: 'Joeboy', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'teni', name: 'Teni', category: 'Music', profession: 'Musician', gender: 'female', state_or_region: 'Lagos', image: null },
  { id: 'patoranking', name: 'Patoranking', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: null, image: null },
  { id: '2baba', name: '2Baba', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: 'Benue', image: null },
  { id: 'dbanj', name: "D'banj", category: 'Music', profession: 'Musician', gender: 'male', state_or_region: null, image: null },
  { id: 'don-jazzy', name: 'Don Jazzy', category: 'Music', profession: 'Producer', gender: 'male', state_or_region: null, image: null },
  { id: 'falz', name: 'Falz', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: null, image: null },
  { id: 'mayorkun', name: 'Mayorkun', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: null, image: null },
  { id: 'ruger', name: 'Ruger', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: null, image: null },
  { id: 'ckay', name: 'CKay', category: 'Music', profession: 'Musician', gender: 'male', state_or_region: null, image: null },

  // ---- more NOLLYWOOD ----
  { id: 'pete-edochie', name: 'Pete Edochie', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: 'Anambra', image: null },
  { id: 'omotola-jalade-ekeinde', name: 'Omotola Jalade Ekeinde', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: null, image: null },
  { id: 'rita-dominic', name: 'Rita Dominic', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Imo', image: null },
  { id: 'kate-henshaw', name: 'Kate Henshaw', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Cross River', image: null },
  { id: 'nkem-owoh', name: 'Nkem Owoh', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: null, image: null },
  { id: 'patience-ozokwor', name: 'Patience Ozokwor', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: null, image: null },
  { id: 'stephanie-linus', name: 'Stephanie Linus', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Imo', image: null },
  { id: 'nse-ikpe-etim', name: 'Nse Ikpe-Etim', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Akwa Ibom', image: null },
  { id: 'banky-w', name: 'Banky W', category: 'Nollywood', profession: 'Actor / Musician', gender: 'male', state_or_region: null, image: null },
  { id: 'adesua-etomi', name: 'Adesua Etomi', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: null, image: null },
  { id: 'timini-egbuson', name: 'Timini Egbuson', category: 'Nollywood', profession: 'Actor', gender: 'male', state_or_region: null, image: null },
  { id: 'tonto-dikeh', name: 'Tonto Dikeh', category: 'Nollywood', profession: 'Actress', gender: 'female', state_or_region: 'Rivers', image: null },

  // ---- more COMEDY ----
  { id: 'akpororo', name: 'Akpororo', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: null, image: null },
  { id: 'lasisi-elenu', name: 'Lasisi Elenu', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: null, image: null },
  { id: 'kie-kie', name: 'Kie Kie', category: 'Comedy', profession: 'Comedian', gender: 'female', state_or_region: null, image: null },
  { id: 'josh2funny', name: 'Josh2Funny', category: 'Comedy', profession: 'Comedian', gender: 'male', state_or_region: null, image: null },

  // ---- more SPORTS ----
  { id: 'jay-jay-okocha', name: 'Jay-Jay Okocha', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Delta', image: null },
  { id: 'nwankwo-kanu', name: 'Nwankwo Kanu', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Imo', image: null },
  { id: 'john-obi-mikel', name: 'John Obi Mikel', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Plateau', image: null },
  { id: 'ahmed-musa', name: 'Ahmed Musa', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: null, image: null },
  { id: 'wilfred-ndidi', name: 'Wilfred Ndidi', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'ademola-lookman', name: 'Ademola Lookman', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: 'UK (diaspora)', image: null },
  { id: 'taiwo-awoniyi', name: 'Taiwo Awoniyi', category: 'Sports', profession: 'Footballer', gender: 'male', state_or_region: null, image: null },
  { id: 'israel-adesanya', name: 'Israel Adesanya', category: 'Sports', profession: 'MMA Fighter', gender: 'male', state_or_region: 'Lagos', image: null },
  { id: 'kamaru-usman', name: 'Kamaru Usman', category: 'Sports', profession: 'MMA Fighter', gender: 'male', state_or_region: 'Edo', image: null },
  { id: 'tobi-amusan', name: 'Tobi Amusan', category: 'Sports', profession: 'Sprinter', gender: 'female', state_or_region: 'Ogun', image: null },

  // ---- more MEDIA ----
  { id: 'mo-abudu', name: 'Mo Abudu', category: 'Media', profession: 'TV Host / Producer', gender: 'female', state_or_region: null, image: null },
  { id: 'linda-ikeji', name: 'Linda Ikeji', category: 'Media', profession: 'Blogger', gender: 'female', state_or_region: null, image: null },
  { id: 'nancy-isime', name: 'Nancy Isime', category: 'Media', profession: 'TV Host', gender: 'female', state_or_region: null, image: null },
  { id: 'daddy-freeze', name: 'Daddy Freeze', category: 'Media', profession: 'Radio Host', gender: 'male', state_or_region: null, image: null },

  // ---- LITERATURE ----
  { id: 'chimamanda-ngozi-adichie', name: 'Chimamanda Ngozi Adichie', category: 'Literature', profession: 'Author', gender: 'female', state_or_region: 'Anambra', image: null },
  { id: 'wole-soyinka', name: 'Wole Soyinka', category: 'Literature', profession: 'Author', gender: 'male', state_or_region: 'Ogun', image: null },
];

// Photos and credits are written by `node scripts/fetch-images.js`
const here = path.dirname(fileURLToPath(import.meta.url));
let images = {};
try {
  images = JSON.parse(fs.readFileSync(path.join(here, 'celebrity-images.json'), 'utf8'));
} catch {
  /* no photos yet: cards fall back to initials */
}
for (const c of CELEBRITIES) {
  if (images[c.id]) {
    c.image = images[c.id].file;
    c.credit = images[c.id].credit;
  }
}

export const CELEBRITY_IDS = new Set(CELEBRITIES.map((c) => c.id));
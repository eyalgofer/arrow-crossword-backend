/**
 * Polish arrow_image_clues_1000_v2.json:
 * - drop weak / non-photographic / too-long answers
 * - fix mangled subjects
 * - fill to exactly 1000 with curated extras
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const v1 = JSON.parse(fs.readFileSync(path.join(dataDir, "arrow_image_clues_500_v1.json"), "utf8"));
const draft = JSON.parse(fs.readFileSync(path.join(dataDir, "arrow_image_clues_1000_v2.json"), "utf8"));

const excludeSubject = new Set(
  v1.map((x) => x.subject.toLowerCase().replace(/[-–—']/g, " ").replace(/\s+/g, " ").trim())
);
const excludeAnswer = new Set(v1.map((x) => x.answer_hebrew.replace(/\s+/g, "")));

function normSubject(s) {
  return s.toLowerCase().replace(/[-–—']/g, " ").replace(/\s+/g, " ").trim();
}
function letterLen(he) {
  return Array.from(he.replace(/\s+/g, "")).length;
}

const FIX_SUBJECT = {
  "robert downey": "Robert Downey Jr",
  stevie: "Stevie Wonder",
  "coldplay chris martin": "Chris Martin",
  "rita singer": "Rita",
  "muki singer": "Muki",
  "dikla singer": "Dikla",
  "malala": "Malala Yousafzai",
  "alexandria ocasio": "Alexandria Ocasio-Cortez",
  "rfk jr": "Robert F Kennedy Jr",
  "check point gil": "Gil Shwed",
  "windsurfer shahar": "Shahar Zubari",
  "maraton maru": "Maru Teferi",
  "paul rudd paul": "Paul Rudd",
  "will ferrell wf": "Will Ferrell",
  "bryan cranston walter": "Bryan Cranston",
  "joe rogan jr": "Joe Rogan",
  "greta thunberg gt": "Greta Thunberg",
  "mike tyson mt": "Mike Tyson",
  "muhammad ali ma": "Muhammad Ali",
  "michael phelps mp": "Michael Phelps",
  "tom brady tb": "Tom Brady",
  "lionel messi lm": "Lionel Messi",
  "lionel messi goat": "Lionel Messi",
  "cristiano ronaldo cr": "Cristiano Ronaldo",
  "cristiano ronaldo cr7": "Cristiano Ronaldo",
  "kylian mbappe km": "Kylian Mbappe",
  "erling haaland eh": "Erling Haaland",
  "neymar jr": "Neymar",
  "anne frank af": "Anne Frank",
  "yitzhak shamir ys": "Yitzhak Shamir",
  "ariel sharon as": "Ariel Sharon",
  "ehud barak eb2": "Ehud Barak",
  "yair lapid yl": "Yair Lapid",
  "naftali bennett nb2": "Naftali Bennett",
  "shimon peres sp": "Shimon Peres",
  "chaim weizmann cw": "Chaim Weizmann",
};

const DROP_SUBJECTS = new Set(
  [
    "jesus",
    "moses",
    "abraham",
    "muhammad",
    "buddha",
    "king david",
    "king solomon",
    "aristotle",
    "plato",
    "socrates",
    "confucius",
    "galen",
    "hippocrates",
    "raphael",
    "cher", // 2 letters
    "bach",
    "manuel",
    "victor",
    "robert",
    "james",
    "tony",
    "luka",
    "gareth",
    "mohamed",
    "kylian",
    "erling",
    "oscar",
    "keanu",
    "krysten",
    "kate",
    "kristen",
    "eddie",
    "sofia",
    "oprah", // keep Oprah Winfrey if present; drop bare Oprah if short
    "ellen",
    "heidi",
    "kendall",
    "katy",
    "billie",
    "olivia",
    "sabrina",
    "harry",
    "venus",
    "serena",
    "roger",
    "rafa",
    "novak",
    "lewis",
    "max",
    "sebastian",
    "ayrton",
    "usain",
    "simone",
    "katie",
    "conor",
    "floyd",
    "manny",
    "dalai",
    "malala", // fixed to full name in FIX
    "alexandria",
    "bernie",
    "aoc",
    "ivri",
    "cristiano",
    "satya",
    "sundar",
    "warren",
    "naomi",
    "andy",
    "gabriel",
    "phil dunphy",
    "modern family phil",
    "mr bean",
    "ali g",
    "bruno",
    "borat",
    "infected mushroom",
    "astral projection",
    "major lazer",
    "blackpink jennie",
    "bts jungkook",
    "bts rm",
    "bts v",
    "bts jimin",
    "bts suga",
    "bts jin",
    "bts j hope",
    "blackpink lisa",
    "blackpink rosé",
    "blackpink rose",
    "blackpink jisoo",
    "iu",
    "g dragon",
    "twitch ninja",
    "one direction harry",
    "coldplay chris martin",
    "the weeknd abel",
    "bob dylan robert",
    "harrison",
    "pope benedict xvi", // too long hebrew
    "pope john paul ii",
  ].map((s) => s.toLowerCase())
);

/** Extra curated famous people (subject|hebrew|category|country|rec|isr|glob|diff) */
const EXTRA = `
Chris Hemsworth|כריס המסוורת'|actors|Australia|5|2|5|1
Chris Evans|כריס אוונס|actors|USA|5|2|5|1
Zendaya Coleman|זנדאיה|actors|USA|5|2|5|1
Timothee Chalamet|טימותי שאלאמה|actors|USA|5|2|5|1
Florence Pugh|פלורנס פיו|actors|UK|4|2|4|2
Sydney Sweeney|סידני סוויני|actors|USA|5|2|5|1
Glen Powell|גלן פאוול|actors|USA|4|2|4|2
Jacob Elordi|ג'ייקוב אלורדי|actors|Australia|4|2|4|2
Jenna Ortega|ג'נה אורטגה|actors|USA|5|2|5|1
Austin Butler|אוסטין באטלר|actors|USA|4|2|4|2
Barry Keoghan|בארי קיוגאן|actors|Ireland|4|2|4|2
Paul Mescal|פול מסקל|actors|Ireland|4|2|4|2
Andrew Scott|אנדרו סקוט|actors|Ireland|4|2|4|2
Phoebe Waller-Bridge|פיבי וולר ברידג'|actors|UK|4|2|4|2
Olivia Colman|אוליביה קולמן|actors|UK|4|2|4|2
Jodie Comer|ג'ודי קומר|actors|UK|4|2|4|2
Brian Cox Actor|בריאן קוקס|actors|UK|4|2|4|2
Jeremy Allen White|ג'רמי אלן וייט|actors|USA|4|2|4|2
Ayo Edebiri|איו אדבירי|actors|USA|3|2|3|3
Quinta Brunson|קווינטה ברונסון|actors|USA|3|2|3|3
Hassan Minhaj|חסן מינהאג'|comedy|USA|3|2|3|3
John Cena|ג'ון סינה|actors|USA|5|2|5|1
The Rock|דה רוק|actors|USA|5|2|5|1
Dave Bautista|דייב בטיסטה|actors|USA|4|2|4|2
Randy Orton|רנדי אורטון|athletics|USA|3|2|3|3
Undertaker|אנדרטייקר|athletics|USA|4|2|4|2
Stone Cold Steve Austin|סטון קולד סטיב אוסטין|athletics|USA|4|2|4|2
Hulk Hogan|האלק הוגאן|athletics|USA|5|2|5|1
John Wick Keanu|קיאנו ריבס|actors|Canada|5|2|5|1
Laurence Fishburne|לורנס פישבורן|actors|USA|4|2|4|2
Carrie-Anne Moss|קארי אן מוס|actors|Canada|4|2|4|2
Hugo Weaving|יוגו ויבינג|actors|Australia|3|2|3|3
Monica Bellucci|מוניקה בלוצ'י|actors|Italy|5|2|5|1
Penelope Cruz|פנלופה קרוז|actors|Spain|5|2|5|1
Javier Bardem|חאבייר ברדם|actors|Spain|5|2|5|1
Antonio Banderas|אנטוניו בנדרס|actors|Spain|5|2|5|1
Salma Hayek|סלמה הייק|actors|Mexico|5|2|5|1
Gael Garcia Bernal|גאל גארסיה ברנאל|actors|Mexico|3|2|3|3
Diego Luna|דייגו לונה|actors|Mexico|4|2|4|2
Wagner Moura|ואגנר מורה|actors|Brazil|3|2|3|3
Sophie Turner|סופי טרנר|actors|UK|5|2|5|1
Maisie Williams|מייזי ויליאמס|actors|UK|5|2|5|1
Kit Harington|קיט הרינגטון|actors|UK|5|2|5|1
Emilia Clarke|אמיליה קלארק|actors|UK|5|2|5|1
Peter Dinklage|פיטר דינקלג'|actors|USA|5|2|5|1
Nikolaj Coster-Waldau|ניקולאי קוסטר ולדאו|actors|Denmark|4|2|4|2
Lena Headey|לינה הידי|actors|UK|4|2|4|2
Jason Momoa Aquaman|ג'ייסון מומואה|actors|USA|5|2|5|1
Henry Cavill Superman|הנרי קאוויל|actors|UK|5|2|5|1
Galen Rupp|גיילן ראפ|athletics|USA|2|2|2|4
Eliud Kipchoge|אליוד קיפצ'וגה|athletics|Kenya|5|2|5|1
Mo Farah|מו פארה|athletics|UK|4|2|4|2
Allyson Felix|אליסון פליקס|athletics|USA|4|2|4|2
Florence Griffith-Joyner|פלורנס גריפית' ג'וינר|athletics|USA|3|2|3|3
Carl Lewis|קארל לואיס|athletics|USA|4|2|4|2
Jesse Owens|ג'סי אוונס|athletics|USA|5|2|5|1
Jackie Joyner-Kersee|ג'קי ג'וינר קרסי|athletics|USA|3|2|3|3
Nadia Comaneci|נדיה קומנצ'י|olympics|Romania|5|2|5|1
Olga Korbut|אולגה קורבוט|olympics|Belarus|3|2|3|3
Larisa Latynina|לריסה לטינינה|olympics|Ukraine|2|2|2|4
Mark Spitz|מארק שפיץ|swimming|USA|4|2|4|2
Ian Thorpe|איאן תורפ|swimming|Australia|4|2|4|2
Caeleb Dressel|קיילב דרסל|swimming|USA|3|2|3|3
Katie Ledecky Swim|קייטי לדצקי|swimming|USA|4|2|4|2
Missy Franklin|מיסי פרנקלין|swimming|USA|3|2|3|3
Ryan Lochte|ראיין לוכטי|swimming|USA|3|2|3|3
Michael Johnson Runner|מייקל ג'ונסון|athletics|USA|4|2|4|2
Asafa Powell|אסאפה פאוול|athletics|Jamaica|3|2|3|3
Yohan Blake|יוהאן בלייק|athletics|Jamaica|3|2|3|3
Shelly-Ann Fraser-Pryce|שלי אן פרייזר פרייס|athletics|Jamaica|4|2|4|2
Elaine Thompson-Herah|איליין תומפסון הירה|athletics|Jamaica|3|2|3|3
Sha'Carri Richardson|שכארי ריצ'רדסון|athletics|USA|4|2|4|2
Noah Lyles|נואה ליילס|athletics|USA|4|2|4|2
Armand Duplantis|ארמנד דופלנטיס|athletics|Sweden|4|2|4|2
Sydney McLaughlin|סידני מקלוגלין|athletics|USA|4|2|4|2
Athing Mu|אתינג מו|athletics|USA|2|2|2|4
Grant Holloway|גרנט הולוויי|athletics|USA|2|2|2|4
Rai Benjamin|ראי בנג'מין|athletics|USA|2|2|2|4
Karsten Warholm|קארסטן וורהולם|athletics|Norway|3|2|3|3
Jakob Ingebrigtsen|יעקב אינגבריגטסן|athletics|Norway|4|2|4|2
Joshua Cheptegei|ג'ושוע צ'פטגי|athletics|Uganda|3|2|3|3
Faith Kipyegon|פיית' קיפייגון|athletics|Kenya|4|2|4|2
Sifan Hassan|סיפאן חסן|athletics|Netherlands|4|2|4|2
Letesenbet Gidey|לטסנבט גידיי|athletics|Ethiopia|2|2|2|4
Tigist Assefa|טיגיסט אספה|athletics|Ethiopia|2|2|2|4
Kelvin Kiptum|קלווין קיפטום|athletics|Kenya|3|2|3|3
Ruth Chepngetich|רות צ'פנגטיץ'|athletics|Kenya|2|2|2|4
Brigid Kosgei|בריג'יד קוסגיי|athletics|Kenya|3|2|3|3
Kenenisa Bekele|קנניסה בקלה|athletics|Ethiopia|3|2|3|3
Haile Gebrselassie|היילה גבריסלאסי|athletics|Ethiopia|4|2|4|2
Abebe Bikila|אבה בקילה|athletics|Ethiopia|3|2|3|3
Emil Zatopek|אמיל זאטופק|athletics|Czechia|3|2|3|3
Paavo Nurmi|פאבו נורמי|athletics|Finland|2|2|2|4
Sebastian Coe|סבסטיאן קו|athletics|UK|3|2|3|3
Steve Prefontaine|סטיב פרפונטיין|athletics|USA|3|2|3|3
Roger Bannister|רוג'ר בניסטר|athletics|UK|3|2|3|3
Edwin Moses|אדווין מוזס|athletics|USA|3|2|3|3
Michael Jordan MJ|מייקל ג'ורדן|basketball|USA|5|2|5|1
Scottie Pippen|סקוטי פיפן|basketball|USA|4|2|4|2
Dennis Rodman|דניס רודמן|basketball|USA|5|2|5|1
Charles Barkley|צ'ארלס בארקלי|basketball|USA|5|2|5|1
Patrick Ewing|פטריק יואינג|basketball|USA|4|2|4|2
Hakeem Olajuwon|חכים אולאג'וון|basketball|Nigeria|4|2|4|2
David Robinson|דייוויד רובינסון|basketball|USA|4|2|4|2
Karl Malone|קארל מלון|basketball|USA|4|2|4|2
John Stockton|ג'ון סטוקטון|basketball|USA|4|2|4|2
Gary Payton|גארי פייטון|basketball|USA|3|2|3|3
Jason Kidd|ג'ייסון קיד|basketball|USA|4|2|4|2
Steve Kerr|סטיב קר|basketball|USA|4|2|4|2
Gregg Popovich|גרג פופוביץ'|basketball|USA|4|2|4|2
Phil Jackson|פיל ג'קסון|basketball|USA|4|2|4|2
Pat Riley|פאט ריילי|basketball|USA|3|2|3|3
Doc Rivers|דוק ריברס|basketball|USA|3|2|3|3
Erik Spoelstra|אריק ספולסטרה|basketball|USA|3|2|3|3
Joe Mazzulla|ג'ו מאזולה|basketball|USA|2|2|2|4
Billie Eilish BE|בילי אייליש|music|USA|5|2|5|1
Olivia Rodrigo OR|אוליביה רודריגו|music|USA|4|2|4|2
Sabrina Carpenter SC|סברינה קרפנטר|music|USA|4|2|4|2
Chappell Roan|צ'אפל רואן|music|USA|4|2|4|2
SZA|אס זד איי|music|USA|4|2|4|2
Ice Spice|אייס ספייס|music|USA|3|2|3|3
Latto|לאטו|music|USA|2|2|2|4
Megan Thee Stallion|מיגן די סטאליון|music|USA|4|2|4|2
Lizzo|ליזו|music|USA|4|2|4|2
Doja Cat DC|דוג'ה קאט|music|USA|4|2|4|2
Tyler the Creator|טיילר דה קריאייטור|music|USA|4|2|4|2
Childish Gambino|צ'יילדיש גמבינו|music|USA|4|2|4|2
Frank Ocean|פרנק אושן|music|USA|4|2|4|2
Kendrick Lamar|קנדריק לאמאר|music|USA|5|2|5|1
J Cole|ג'יי קול|music|USA|4|2|4|2
Future|פיוצ'ר|music|USA|4|2|4|2
Metro Boomin|מטרו בומין|music|USA|3|2|3|3
Gunna|גאנה|music|USA|2|2|2|4
Young Thug|יאנג ת'אג|music|USA|3|2|3|3
Offset|אופסט|music|USA|3|2|3|3
Quavo|קוואבו|music|USA|3|2|3|3
Takeoff|טייקאוף|music|USA|2|2|2|4
Migos|מיגוס|music|USA|3|2|3|3
21 Savage|טוונטי וואן סאבאג'|music|USA|4|2|4|2
Lil Baby|ליל בייבי|music|USA|3|2|3|3
DaBaby|דה בייבי|music|USA|3|2|3|3
Roddy Ricch|רודי ריץ'|music|USA|3|2|3|3
Pop Smoke|פופ סמוק|music|USA|3|2|3|3
Juice WRLD|ג'וס וורלד|music|USA|4|2|4|2
XXXTentacion|אקס אקס אקס טנטסיון|music|USA|4|2|4|2
Lil Uzi Vert|ליל יוזי ורט|music|USA|3|2|3|3
Playboi Carti|פלייבוי קרטי|music|USA|3|2|3|3
Travis Scott TS|טראוויס סקוט|music|USA|4|2|4|2
Post Malone PM|פוסט מלון|music|USA|4|2|4|2
The Weeknd Abel Tesfaye|דה ויקנד|music|Canada|5|2|5|1
Drake Aubrey|דרייק|music|Canada|5|2|5|1
Nicki Minaj NM|ניקי מינאז'|music|USA|5|2|5|1
Cardi B CB|קארדי בי|music|USA|4|2|4|2
Bad Bunny BB|באד באני|music|Puerto Rico|4|2|4|2
J Balvin|ג'יי בלוין|music|Colombia|4|2|4|2
Maluma|מלומה|music|Colombia|4|2|4|2
Karol G|קרול ג'י|music|Colombia|4|2|4|2
Rosalia|רוסליה|music|Spain|4|2|4|2
Anitta|אניטה|music|Brazil|3|2|3|3
Peso Pluma|פסו פלומה|music|Mexico|3|2|3|3
Grupo Frontera|גרופו פרונטרה|music|Mexico|2|2|2|4
Feid|פייד|music|Colombia|2|2|2|4
Rauw Alejandro|ראו אלחנדרו|music|Puerto Rico|3|2|3|3
Ozuna|אוזונה|music|Puerto Rico|4|2|4|2
Jhayco|ג'ייקו|music|Puerto Rico|2|2|2|4
Myke Towers|מייק טאוורס|music|Puerto Rico|2|2|2|4
Farruko|פארוקו|music|Puerto Rico|2|2|2|4
Natti Natasha|נאטי נטשה|music|Dominican Republic|3|2|3|3
Becky G|בקי ג'י|music|USA|3|2|3|3
Camila Cabello|קמילה קביו|music|USA|5|2|5|1
Shawn Mendes SM2|שון מנדס|music|Canada|4|2|4|2
Charlie Puth|צ'ארלי פות'|music|USA|4|2|4|2
Halsey Ashley|הולזי|music|USA|4|2|4|2
Lorde Ella|לורד|music|New Zealand|4|2|4|2
Billie Joe Armstrong|בילי ג'ו ארמסטרונג|music|USA|4|2|4|2
Kurt Cobain|קארט קוביין|music|USA|5|2|5|1
Dave Grohl|דייב גרוהל|music|USA|5|2|5|1
Eddie Vedder|אדי ודר|music|USA|4|2|4|2
Chris Cornell|כריס קורנל|music|USA|4|2|4|2
Layne Staley|ליין סטיילי|music|USA|3|2|3|3
Axl Rose|אקסל רוז|music|USA|5|2|5|1
Slash|סלאש|music|UK|5|2|5|1
James Hetfield|ג'יימס הטפילד|music|USA|4|2|4|2
Lars Ulrich|לארס אולריך|music|Denmark|4|2|4|2
Ozzy Osbourne|אוזי אוסבורן|music|UK|5|2|5|1
Tony Iommi|טוני איומי|music|UK|3|2|3|3
Jimmy Page|ג'ימי פייג'|music|UK|5|2|5|1
Robert Plant|רוברט פלאנט|music|UK|5|2|5|1
Roger Waters|רוג'ר ווטרס|music|UK|4|2|4|2
David Gilmour|דייוויד גילמור|music|UK|4|2|4|2
Eric Clapton|אריק קלפטון|music|UK|5|2|5|1
Jimi Hendrix|ג'ימי הנדריקס|music|USA|5|2|5|1
Janis Joplin|ג'ניס ג'ופלין|music|USA|4|2|4|2
Jim Morrison|ג'ים מוריסון|music|USA|5|2|5|1
Keith Moon|קית' מון|music|UK|3|2|3|3
Pete Townshend|פיט טאונשנד|music|UK|3|2|3|3
Roger Daltrey|רוג'ר דאלטרי|music|UK|3|2|3|3
Brian May|בריאן מיי|music|UK|5|2|5|1
Roger Taylor|רוג'ר טיילור|music|UK|3|2|3|3
John Deacon|ג'ון דיקון|music|UK|3|2|3|3
Annie Lennox|אני לנוקס|music|UK|4|2|4|2
Boy George|בוי ג'ורג'|music|UK|4|2|4|2
George Michael|ג'ורג' מייקל|music|UK|5|2|5|1
Wham George|ג'ורג' מייקל|music|UK|5|2|5|1
Dua Lipa DL|דואה ליפה|music|UK|5|2|5|1
Harry Styles HS2|הארי סטיילס|music|UK|5|2|5|1
Ed Sheeran ES|אד שירן|music|UK|5|2|5|1
Adele Adkins|אדל|music|UK|5|2|5|1
Sam Smith SS|סם סמית'|music|UK|4|2|4|2
Lewis Capaldi|לואיס קפלדי|music|UK|4|2|4|2
Stormzy|סטורמזי|music|UK|3|2|3|3
Dave Rapper|דייב|music|UK|2|2|2|4
Central Cee|סנטרל סי|music|UK|3|2|3|3
Burna Boy|בורנה בוי|music|Nigeria|4|2|4|2
Wizkid|ויזקיד|music|Nigeria|4|2|4|2
Davido|דאווידו|music|Nigeria|3|2|3|3
Tems|טמס|music|Nigeria|3|2|3|3
Rema|רמה|music|Nigeria|3|2|3|3
Ayra Starr|אירה סטאר|music|Nigeria|2|2|2|4
Tyla|טילה|music|South Africa|3|2|3|3
Black Coffee|בלאק קופי|music|South Africa|2|2|2|4
Hugh Masekela|יו מסקלה|music|South Africa|2|2|2|4
Miriam Makeba|מרים מקבה|music|South Africa|3|2|3|3
Fela Kuti|פלה קוטי|music|Nigeria|3|2|3|3
Youssou NDour|יוסו נדור|music|Senegal|2|2|2|4
Cesaria Evora|סזריה אבורה|music|Cape Verde|2|2|2|4
Buena Vista Social|איברהים פרר|music|Cuba|2|2|2|4
Compay Segundo|קומפאיי סגונדו|music|Cuba|2|2|2|4
Celia Cruz|סליה קרוז|music|Cuba|4|2|4|2
Tito Puente|טיטו פואנטה|music|USA|2|2|2|4
Carlos Santana|קרלוס סנטנה|music|Mexico|5|2|5|1
Gloria Estefan|גלוריה אסטפן|music|USA|4|2|4|2
Julio Iglesias|חוליו איגלסיאס|music|Spain|5|2|5|1
Enrique Iglesias|אנריקה איגלסיאס|music|Spain|5|2|5|1
Alejandro Sanz|אלחנדרו סאנס|music|Spain|3|2|3|3
Juanes|חואנס|music|Colombia|3|2|3|3
Manu Chao|מנו צ'או|music|France|3|2|3|3
Stromae|סטרומה|music|Belgium|4|2|4|2
Aya Nakamura|איה נקמורה|music|France|3|2|3|3
Indila|אינדילה|music|France|3|2|3|3
Zaz|זאז|music|France|2|2|2|4
Edith Piaf|אדיט פיאף|music|France|5|2|5|1
Charles Aznavour|שארל אזנבור|music|France|4|3|4|2
Serge Gainsbourg|סרז' גינסבורג|music|France|3|2|3|3
Jacques Brel|ז'אק ברל|music|Belgium|3|2|3|3
ABBA Agnetha|אגנתה פלטסקוג|music|Sweden|3|2|3|3
Bjorn Ulvaeus|ביורן אולבאוס|music|Sweden|3|2|3|3
Benny Andersson|בני אנדרסון|music|Sweden|3|2|3|3
Anni-Frid Lyngstad|אני פריד לינגסטד|music|Sweden|3|2|3|3
Roxette|רוקסט|music|Sweden|3|2|3|3
Ace of Base|אייס אוף בייס|music|Sweden|2|2|2|4
Avicii Tim|אביצ'י|music|Sweden|5|2|5|1
Swedish House Mafia|סווידיש האוס מאפיה|music|Sweden|3|2|3|3
Kygo Kyrre|קייגו|music|Norway|4|2|4|2
Alan Walker|אלן ווקר|music|Norway|4|2|4|2
A-ha|אה הא|music|Norway|3|2|3|3
Bjork|ביורק|music|Iceland|5|2|5|1
Of Monsters and Men|אוף מונסטרס אנד מן|music|Iceland|2|2|2|4
Sigur Ros|סיגור רוס|music|Iceland|2|2|2|4
Vangelis|ונגליס|music|Greece|3|2|3|3
Nana Mouskouri|ננה מושקורי|music|Greece|2|2|2|4
Maria Callas|מריה קאלאס|music|Greece|4|2|4|2
Placido Domingo|פלאסידו דומינגו|music|Spain|4|2|4|2
Jose Carreras|חוסה קאררס|music|Spain|3|2|3|3
Luciano Pavarotti LP|לוצ'אנו פאבארוטי|music|Italy|5|2|5|1
Andrea Bocelli AB|אנדריאה בוצ'לי|music|Italy|5|2|5|1
Ennio Morricone|אניו מוריקונה|music|Italy|4|2|4|2
Hans Zimmer|הנס צימר|music|Germany|5|2|5|1
John Williams Composer|ג'ון ויליאמס|music|USA|5|2|5|1
Howard Shore|הווארד שור|music|Canada|3|2|3|3
Danny Elfman|דני אלפמן|music|USA|3|2|3|3
Thomas Newman|תומאס ניומן|music|USA|2|2|2|4
Alan Silvestri|אלן סילבסטרי|music|USA|2|2|2|4
James Horner|ג'יימס הורנר|music|USA|2|2|2|4
John Williams Star Wars|ג'ון ויליאמס|music|USA|5|2|5|1
Lin-Manuel Miranda|לין מנואל מירנדה|music|USA|5|2|5|1
Stephen Sondheim|סטיבן סונדהיים|music|USA|3|2|3|3
Andrew Lloyd Webber|אנדרו לויד ובר|music|UK|5|2|5|1
Tim Rice|טים רייס|music|UK|2|2|2|4
Julie Andrews|ג'ולי אנדרוז|actors|UK|5|2|5|1
Audrey Hepburn AH|אודרי הפבורן|actors|UK|5|2|5|1
Grace Kelly GK|גרייס קלי|actors|USA|4|2|4|2
Ingrid Bergman|אינגריד ברגמן|actors|Sweden|4|2|4|2
Greta Garbo|גרטה גרבו|actors|Sweden|3|2|3|3
Marlene Dietrich|מרלן דיטריך|actors|Germany|3|2|3|3
Sophia Loren|סופיה לורן|actors|Italy|5|2|5|1
Gina Lollobrigida|ג'ינה לולובריג'ידה|actors|Italy|3|2|3|3
Brigitte Bardot|בריז'יט בארדו|actors|France|4|2|4|2
Catherine Deneuve|קתרין דנב|actors|France|3|2|3|3
Juliette Binoche|ז'ולייט בינוש|actors|France|3|2|3|3
Marion Cotillard|מריון קוטיאר|actors|France|4|2|4|2
Isabelle Huppert|איזבל הופר|actors|France|3|2|3|3
Jean Reno|ז'אן רנו|actors|France|4|2|4|2
Gerard Depardieu|ז'ראר דפרדיה|actors|France|4|2|4|2
Omar Sy|עומר סי|actors|France|4|2|4|2
Jean Dujardin|ז'אן דוז'ארדן|actors|France|3|2|3|3
Vincent Cassel|ונסן קאסל|actors|France|3|2|3|3
Eva Green|אווה גרין|actors|France|4|2|4|2
Lea Seydoux|לאה סיידו|actors|France|4|2|4|2
Adele Exarchopoulos|אדל אקסארCopoulos|actors|France|2|2|2|4
`.trim();

function parseExtra(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("//")) continue;
    const [subject, answer_hebrew, category, country, recognition, israeli_relevance, global_relevance, difficulty] =
      t.split("|");
    if (!subject || !answer_hebrew) continue;
    out.push({
      subject: subject.trim(),
      answer_hebrew: answer_hebrew.trim(),
      category: category.trim(),
      country: country.trim(),
      recognition: Number(recognition),
      israeli_relevance: Number(israeli_relevance),
      global_relevance: Number(global_relevance),
      difficulty: Number(difficulty),
    });
  }
  return out;
}

function cleanSubject(subject) {
  let s = subject.trim();
  const key = normSubject(s);
  if (FIX_SUBJECT[key]) s = FIX_SUBJECT[key];
  // strip generation tags that are all-caps short tokens at end
  s = s
    .replace(
      /\s+\b(OA|NK|EG|ST|BE|EH2|EBZ|NB|SH|KP|IL|RK|SA|YG|OH|AE|SH2|BS|DT|MP2|IL2|IR|HBA|NK2|MG|AZ|SM|MM|HS|RF|EB|MB|YR|NG|GG|YA|CA|SI|RK2|AA|IM|AP|ON|CR7|GOAT|LM|CR|KM|EH|MT|MA|SJ|BG|MZ|EM|TC|TB|MP|GT|BN|YR2|DBG|GM|SP|CW|AS|EB2|YL|NB2|WF|JG|YS|BE|OR|SC|DC|NM|CB|BB|DL|HS2|ES|SS|SM2|LP|AB|AH|GK|MJ|TS|PM)\b$/i,
      ""
    )
    .replace(/\s+(Singer|Wonder|Chef|Sail|Judo|Gym|Actor|Swim|Runner|Composer|Star Wars|Aquaman|Superman|Abel Tesfaye|Aubrey|Adkins|Ashley|Ella|Tim|Kyrre)$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // restore known cases wiped by suffix strip
  if (s === "Stevie") s = "Stevie Wonder";
  if (s === "Robert Downey") s = "Robert Downey Jr";
  if (s === "John Wick Keanu") s = "Keanu Reeves";
  if (s === "Brian Cox Actor" || s === "Brian Cox") s = "Brian Cox";
  if (s === "The Rock") s = "Dwayne Johnson";
  if (s === "Wham George") s = "George Michael";
  if (s === "Adele Exarchopoulos") return null; // bad hebrew typo row
  return s;
}

function qualityOk(subject, answer) {
  const ns = normSubject(subject);
  if (DROP_SUBJECTS.has(ns)) return false;
  const len = letterLen(answer);
  if (len < 4 || len > 14) return false;
  // Prefer real multi-word OR highly iconic mononyms with len>=4
  const words = subject.trim().split(/\s+/).length;
  if (words === 1 && len < 5 && !/^(Madonna|Adele|Beyonce|Rihanna|Eminem|Drake|Usher|Sting|Prince|PSY|Sia|Pink|Oprah|Cher)$/i.test(subject)) {
    return false;
  }
  // No photographic ancient figures already dropped; also skip very long papal titles etc.
  if (/^pope /i.test(subject) && len > 14) return false;
  return true;
}

function toRow(p, idNum) {
  return {
    id: `img_${String(idNum).padStart(4, "0")}`,
    type: "person",
    category: p.category,
    subject: p.subject,
    answer_hebrew: p.answer_hebrew,
    aliases_hebrew: "",
    country: p.country,
    recognition: p.recognition,
    difficulty: p.difficulty,
    israeli_relevance: p.israeli_relevance,
    global_relevance: p.global_relevance,
    image_source: "",
    source_url: "",
    author: "",
    license: "",
    s3_key: "",
    active: true,
    notes: "v2 people seed — verify Hebrew spelling & Commons face match",
  };
}

const seenSubject = new Set();
const seenAnswer = new Set();
const kept = [];

function tryAdd(p) {
  const subject = cleanSubject(p.subject);
  if (!subject) return false;
  const answer = p.answer_hebrew.trim();
  const ns = normSubject(subject);
  const na = answer.replace(/\s+/g, "");
  if (!qualityOk(subject, answer)) return false;
  if (excludeSubject.has(ns) || excludeAnswer.has(na)) return false;
  if (seenSubject.has(ns) || seenAnswer.has(na)) return false;
  seenSubject.add(ns);
  seenAnswer.add(na);
  kept.push({
    subject,
    answer_hebrew: answer,
    category: p.category || "celebrity",
    country: p.country || "",
    recognition: p.recognition ?? 4,
    difficulty: p.difficulty ?? 2,
    israeli_relevance: p.israeli_relevance ?? 2,
    global_relevance: p.global_relevance ?? 4,
  });
  return true;
}

// 1) draft
for (const row of draft) {
  tryAdd(row);
}

// 2) extras
for (const row of parseExtra(EXTRA)) {
  tryAdd(row);
}

console.log("after polish pool", kept.length);

kept.sort((a, b) => {
  const score = (p) =>
    p.recognition * 100 + p.global_relevance * 10 + p.israeli_relevance * 5 - p.difficulty;
  return score(b) - score(a);
});

if (kept.length < 1000) {
  console.error(`Only ${kept.length} quality people after polish — need more extras`);
  process.exit(1);
}

const finalList = kept.slice(0, 1000).map((p, i) => toRow(p, 501 + i));
const outPath = path.join(dataDir, "arrow_image_clues_1000_v2.json");
fs.writeFileSync(outPath, JSON.stringify(finalList, null, 2) + "\n");

const lens = finalList.map((x) => letterLen(x.answer_hebrew));
const cats = {};
for (const x of finalList) cats[x.category] = (cats[x.category] || 0) + 1;
const mono = finalList.filter((x) => x.subject.split(/\s+/).length === 1);
console.log("Wrote", outPath, "count", finalList.length);
console.log("categories", cats);
console.log(
  "letterLength min/avg/max",
  Math.min(...lens),
  (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1),
  Math.max(...lens)
);
console.log("mononyms", mono.length, mono.slice(0, 15).map((x) => x.subject).join(", "));
console.log("head", finalList.slice(0, 8).map((x) => `${x.id} ${x.subject} → ${x.answer_hebrew}`));
console.log("tail", finalList.slice(-8).map((x) => `${x.id} ${x.subject} → ${x.answer_hebrew}`));

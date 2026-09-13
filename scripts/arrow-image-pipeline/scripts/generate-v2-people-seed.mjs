/**
 * One-shot generator: arrow_image_clues_1000_v2.json
 * Curated globally/Israeli-famous people for image-clue approval.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const v1 = JSON.parse(
  fs.readFileSync(path.join(dataDir, "arrow_image_clues_500_v1.json"), "utf8")
);

const excludeSubject = new Set(
  v1.map((x) => x.subject.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim())
);
const excludeAnswer = new Set(
  v1.map((x) => x.answer_hebrew.replace(/\s+/g, ""))
);

function normSubject(s) {
  return s.toLowerCase().replace(/[-–—']/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Pipe rows: subject|answer_hebrew|category|country|recognition|israeli|global|difficulty
 * recognition/israeli/global/difficulty are 1–5 (difficulty 1=easy).
 */
const ROWS = `
Tom Cruise|טום קרוז|actors|USA|5|2|5|1
Johnny Depp|ג'וני דפ|actors|USA|5|2|5|1
Brad Pitt|בראד פיט|actors|USA|5|2|5|1
Leonardo DiCaprio|ליאונרדו דיקפריו|actors|USA|5|2|5|1
Will Smith|ויל סמית'|actors|USA|5|2|5|1
Denzel Washington|דנזל וושינגטון|actors|USA|5|2|5|1
Robert Downey Jr|רוברט דאוני ג'וניור|actors|USA|5|2|5|1
Chris Hemsworth|כריס המסוורת'|actors|Australia|5|2|5|1
Chris Evans|כריס אוונס|actors|USA|5|2|5|1
Scarlett Johansson|סקארלט ג'והנסון|actors|USA|5|2|5|1
Jennifer Lawrence|ג'ניפר לורנס|actors|USA|5|2|5|1
Emma Stone|אמה סטון|actors|USA|5|2|5|1
Anne Hathaway|אן האת'וויי|actors|USA|5|2|5|1
Natalie Portman|נטלי פורטמן|actors|Israel|5|5|5|1
Meryl Streep|מריל סטריפ|actors|USA|5|2|5|1
Al Pacino|אל פצ'ינו|actors|USA|5|2|5|1
Robert De Niro|רוברט דה נירו|actors|USA|5|2|5|1
Morgan Freeman|מורגן פרימן|actors|USA|5|2|5|1
Samuel L Jackson|סמואל אל ג'קסון|actors|USA|5|2|5|1
Keanu Reeves|קיאנו ריבס|actors|Canada|5|2|5|1
Matt Damon|מאט דיימון|actors|USA|5|2|5|1
Ben Affleck|בן אפלק|actors|USA|5|2|5|1
George Clooney|ג'ורג' קלוני|actors|USA|5|2|5|1
Julia Roberts|ג'וליה רוברטס|actors|USA|5|2|5|1
Sandra Bullock|סנדרה בולוק|actors|USA|5|2|5|1
Nicole Kidman|ניקול קידמן|actors|Australia|5|2|5|1
Charlize Theron|שארליז ת'רון|actors|South Africa|5|2|5|1
Angelina Jolie|אנג'לינה ג'ולי|actors|USA|5|2|5|1
Hugh Jackman|יו ג'קמן|actors|Australia|5|2|5|1
Ryan Reynolds|ראיין ריינולדס|actors|Canada|5|2|5|1
Ryan Gosling|ראיין גוסלינג|actors|Canada|5|2|5|1
Christian Bale|כריסטיאן בייל|actors|UK|5|2|5|1
Heath Ledger|הית' לדג'ר|actors|Australia|5|2|4|2
Joaquin Phoenix|חואקין פיניקס|actors|USA|5|2|5|1
Timothee Chalamet|טימותי שאלאמה|actors|USA|5|2|5|1
Zendaya|זנדאיה|actors|USA|5|2|5|1
Tom Holland|טום הולנד|actors|UK|5|2|5|1
Benedict Cumberbatch|בנדיקט קמברבאץ'|actors|UK|5|2|5|1
Tom Hanks|טום הנקס|actors|USA|5|2|5|1
Robin Williams|רובין ויליאמס|actors|USA|5|2|5|1
Jim Carrey|ג'ים קארי|actors|Canada|5|2|5|1
Adam Sandler|אדם סנדלר|actors|USA|5|2|5|1
Steve Carell|סטיב קארל|actors|USA|5|2|4|2
Will Ferrell|ויל פרל|actors|USA|4|2|4|2
Eddie Murphy|אדי מרפי|actors|USA|5|2|5|1
Chris Pratt|כריס פראט|actors|USA|5|2|5|1
Mark Ruffalo|מארק ראפאלו|actors|USA|4|2|4|2
Jeremy Renner|ג'רמי רנר|actors|USA|4|2|4|2
Paul Rudd|פול ראד|actors|USA|4|2|4|2
Elizabeth Olsen|אליזבת אולסן|actors|USA|4|2|4|2
Florence Pugh|פלורנס פיו|actors|UK|4|2|4|2
Margot Robbie|מרגו רובי|actors|Australia|5|2|5|1
Anya Taylor-Joy|אניה טיילור ג'וי|actors|USA|4|2|4|2
Pedro Pascal|פדרו פסקל|actors|Chile|5|2|5|1
Oscar Isaac|אוסקר אייזק|actors|Guatemala|4|2|4|2
Idris Elba|אידריס אלבה|actors|UK|5|2|5|1
Michael B Jordan|מייקל בי ג'ורדן|actors|USA|5|2|5|1
Chadwick Boseman|צ'דוויק בוזמן|actors|USA|5|2|5|1
Lupita Nyong'o|לופיטה ניונגו|actors|Kenya|4|2|4|2
Viola Davis|ויולה דייוויס|actors|USA|4|2|4|2
Kate Winslet|קייט וינסלט|actors|UK|5|2|5|1
Cate Blanchett|קייט בלאנשט|actors|Australia|5|2|5|1
Helen Mirren|הלן מירן|actors|UK|5|2|5|1
Judi Dench|ג'ודי דנץ'|actors|UK|4|2|4|2
Anthony Hopkins|אנתוני הופקינס|actors|UK|5|2|5|1
Ian McKellen|איאן מקלן|actors|UK|5|2|5|1
Patrick Stewart|פטריק סטיוארט|actors|UK|5|2|5|1
Daniel Craig|דניאל קרייג|actors|UK|5|2|5|1
Pierce Brosnan|פירס ברוסנן|actors|Ireland|5|2|4|2
Sean Connery|שון קונרי|actors|UK|5|2|5|1
Harrison Ford|האריסון פורד|actors|USA|5|2|5|1
Mark Hamill|מארק האמיל|actors|USA|5|2|5|1
Carrie Fisher|קארי פישר|actors|USA|5|2|4|2
Daisy Ridley|דייזי רידלי|actors|UK|4|2|4|2
Adam Driver|אדם דרייבר|actors|USA|4|2|4|2
John Boyega|ג'ון בויגה|actors|UK|4|2|4|2
Reese Witherspoon|ריס וית'רספון|actors|USA|5|2|5|1
Jennifer Aniston|ג'ניפר אניסטון|actors|USA|5|2|5|1
Courteney Cox|קורטני קוקס|actors|USA|4|2|4|2
Matthew Perry|מת'יו פרי|actors|Canada|5|2|4|2
David Schwimmer|דייוויד שווימר|actors|USA|4|2|4|2
Lisa Kudrow|ליסה קודרו|actors|USA|4|2|4|2
Matt LeBlanc|מאט לה בלאנק|actors|USA|4|2|4|2
Bryan Cranston|בראיין קרנסטון|actors|USA|5|2|5|1
Aaron Paul|אהרון פול|actors|USA|4|2|4|2
Bob Odenkirk|בוב אודנקירק|actors|USA|4|2|4|2
Jason Bateman|ג'ייסון בייטמן|actors|USA|4|2|4|2
Laura Linney|לורה ליני|actors|USA|3|2|3|3
Steve Buscemi|סטיב בושמי|actors|USA|4|2|4|2
John Travolta|ג'ון טרבולטה|actors|USA|5|2|5|1
Nicolas Cage|ניקולס קייב'|actors|USA|5|2|5|1
Keira Knightley|קירה נייטלי|actors|UK|5|2|5|1
Emma Watson|אמה ווטסון|actors|UK|5|2|5|1
Daniel Radcliffe|דניאל רדקליף|actors|UK|5|2|5|1
Rupert Grint|רופרט גרינט|actors|UK|4|2|4|2
Orlando Bloom|אורלנדו בלום|actors|UK|5|2|5|1
Elijah Wood|אלייז'ה ווד|actors|USA|4|2|4|2
Viggo Mortensen|ויגו מורטנסן|actors|USA|4|2|4|2
Sean Astin|שון אסטין|actors|USA|3|2|3|3
Liv Tyler|ליב טיילר|actors|USA|4|2|4|2
Kirsten Dunst|קירסטן דנסט|actors|USA|4|2|4|2
Tobey Maguire|טובי מגווייר|actors|USA|5|2|5|1
Andrew Garfield|אנדרו גארפילד|actors|USA|5|2|5|1
Jake Gyllenhaal|ג'ייק ג'ילנהול|actors|USA|5|2|5|1
Joseph Gordon-Levitt|ג'וזף גורדון לוויט|actors|USA|4|2|4|2
James Franco|ג'יימס פרנקו|actors|USA|4|2|4|2
Seth Rogen|סת' רוגן|actors|Canada|4|2|4|2
Jonah Hill|ג'ונה היל|actors|USA|4|2|4|2
Channing Tatum|צ'אנינג טייטום|actors|USA|5|2|5|1
Zoe Saldana|זואי סלדנה|actors|USA|5|2|5|1
Chris Pine|כריס פיין|actors|USA|4|2|4|2
Zachary Quinto|זאכרי קווינטו|actors|USA|3|2|3|3
Simon Pegg|סיימון פג|actors|UK|4|2|4|2
Nick Frost|ניק פרוסט|actors|UK|3|2|3|3
Bill Murray|ביל מאריי|actors|USA|5|2|5|1
Owen Wilson|אוון וילסון|actors|USA|5|2|5|1
Vince Vaughn|וינס וון|actors|USA|4|2|4|2
Ben Stiller|בן סטילר|actors|USA|5|2|5|1
Jack Black|ג'ק בלאק|actors|USA|5|2|5|1
Jason Statham|ג'ייסון סטיית'הם|actors|UK|5|2|5|1
Dwayne Johnson|דוויין ג'ונסון|actors|USA|5|2|5|1
Vin Diesel|וין דיזל|actors|USA|5|2|5|1
Michelle Rodriguez|מישל רודריגז|actors|USA|4|2|4|2
Galileo Galilei|גלילאו גליליי|science|Italy|5|2|5|1
Isaac Newton|אייזק ניוטון|science|UK|5|2|5|1
Albert Einstein|אלברט איינשטיין|science|Germany|5|4|5|1
Marie Curie|מארי קירי|science|Poland|5|2|5|1
Charles Darwin|צ'ארלס דרווין|science|UK|5|2|5|1
Stephen Hawking|סטיבן הוקינג|science|UK|5|2|5|1
Nikola Tesla|ניקולה טסלה|science|Serbia|5|2|5|1
Thomas Edison|תומאס אדיסון|science|USA|5|2|5|1
Alexander Graham Bell|אלכסנדר גרהם בל|science|UK|4|2|4|2
Galen|גאלנוס|science|Turkey|2|1|2|4
Hippocrates|היפוקרטס|science|Greece|3|2|3|3
Aristotle|אריסטו|science|Greece|5|2|5|1
Plato|אפלטון|science|Greece|5|2|5|1
Socrates|סוקרטס|science|Greece|5|2|5|1
Confucius|קונפוציוס|science|China|4|2|4|2
Leonardo da Vinci|ליאונרדו דה וינצ'י|science|Italy|5|2|5|1
Michelangelo|מיכאלאנג'לו|science|Italy|5|2|5|1
Raphael|רפאל|science|Italy|4|2|4|2
Rembrandt|רמברנדט|science|Netherlands|4|2|4|2
Vincent van Gogh|וינסנט ואן גוך|science|Netherlands|5|2|5|1
Pablo Picasso|פבלו פיקאסו|science|Spain|5|2|5|1
Salvador Dali|סלבדור דאלי|science|Spain|5|2|5|1
Frida Kahlo|פרידה קאלו|science|Mexico|5|2|5|1
Andy Warhol|אנדי וורהול|science|USA|4|2|4|2
Claude Monet|קלוד מונה|science|France|4|2|4|2
Steve Jobs|סטיב ג'ובס|technology|USA|5|3|5|1
Bill Gates|ביל גייטס|technology|USA|5|3|5|1
Elon Musk|אילון מאסק|technology|USA|5|3|5|1
Mark Zuckerberg|מארק צוקרברג|technology|USA|5|3|5|1
Jeff Bezos|ג'ף בזוס|technology|USA|5|2|5|1
Tim Cook|טים קוק|technology|USA|4|2|4|2
Sundar Pichai|סונדאר פיצ'אי|technology|India|4|2|4|2
Satya Nadella|סאטיה נאדלה|technology|India|3|2|3|3
Larry Page|לארי פייג'|technology|USA|4|2|4|2
Sergey Brin|סרגיי ברין|technology|USA|4|3|4|2
Jack Ma|ג'ק מא|technology|China|4|2|4|2
Warren Buffett|וורן באפט|business|USA|5|2|5|1
Oprah Winfrey|אופרה וינפרי|media|USA|5|2|5|1
Ellen DeGeneres|אלן דג'נרס|media|USA|5|2|5|1
Jimmy Fallon|ג'ימי פאלון|media|USA|4|2|4|2
Stephen Colbert|סטיבן קולבר|media|USA|4|2|4|2
John Oliver|ג'ון אוליבר|media|UK|4|2|4|2
Trevor Noah|טרבור נואה|media|South Africa|4|2|4|2
Conan OBrien|קונאן אובראיין|media|USA|4|2|4|2
David Letterman|דייוויד לטרמן|media|USA|4|2|4|2
Jay Leno|ג'יי לנו|media|USA|4|2|4|2
Joe Rogan|ג'ו רוגן|media|USA|5|2|5|1
Taylor Swift|טיילור סוויפט|music|USA|5|2|5|1
Beyonce|ביונסה|music|USA|5|2|5|1
Rihanna|ריהאנה|music|Barbados|5|2|5|1
Lady Gaga|ליידי גאגא|music|USA|5|2|5|1
Ariana Grande|אריאנה גרנדה|music|USA|5|2|5|1
Billie Eilish|בילי אייליש|music|USA|5|2|5|1
Drake|דרייק|music|Canada|5|2|5|1
The Weeknd|דה ויקנד|music|Canada|5|2|5|1
Justin Bieber|ג'סטין ביבר|music|Canada|5|2|5|1
Ed Sheeran|אד שירן|music|UK|5|2|5|1
Harry Styles|הארי סטיילס|music|UK|5|2|5|1
Bruno Mars|ברונו מארס|music|USA|5|2|5|1
Shawn Mendes|שון מנדס|music|Canada|4|2|4|2
Katy Perry|קייטי פרי|music|USA|5|2|5|1
Miley Cyrus|מיילי סיירוס|music|USA|5|2|5|1
Selena Gomez|סלינה גומז|music|USA|5|2|5|1
Dua Lipa|דואה ליפה|music|UK|5|2|5|1
Adele|אדל|music|UK|5|2|5|1
Sam Smith|סם סמית'|music|UK|4|2|4|2
Coldplay Chris Martin|כריס מרטין|music|UK|5|2|5|1
Bono|בונו|music|Ireland|5|2|5|1
Freddie Mercury|פרדי מרקיורי|music|UK|5|2|5|1
John Lennon|ג'ון לנון|music|UK|5|2|5|1
Paul McCartney|פול מקרטני|music|UK|5|2|5|1
Ringo Starr|רינגו סטאר|music|UK|4|2|4|2
George Harrison|ג'ורג' הריסון|music|UK|4|2|4|2
Mick Jagger|מיק ג'אגר|music|UK|5|2|5|1
Keith Richards|קית' ריצ'רדס|music|UK|4|2|4|2
Elvis Presley|אלביס פרסלי|music|USA|5|2|5|1
Michael Jackson|מייקל ג'קסון|music|USA|5|2|5|1
Prince|פרינס|music|USA|5|2|5|1
Madonna|מדונה|music|USA|5|2|5|1
Whitney Houston|וויטני יוסטון|music|USA|5|2|5|1
Mariah Carey|מריה קארי|music|USA|5|2|5|1
Celine Dion|סלין דיון|music|Canada|5|2|5|1
Cher|שר|music|USA|5|2|5|1
Tina Turner|טינה טרנר|music|USA|5|2|5|1
Aretha Franklin|אריתה פרנקלין|music|USA|4|2|4|2
Bob Dylan|בוב דילן|music|USA|5|2|5|1
Bruce Springsteen|ברוס ספרינגסטין|music|USA|5|2|5|1
David Bowie|דייוויד בואי|music|UK|5|2|5|1
Elton John|אלטון ג'ון|music|UK|5|2|5|1
Stevie Wonder|סטיבי וונדר|music|USA|5|2|5|1
Billy Joel|בילי ג'ואל|music|USA|4|2|4|2
Phil Collins|פיל קולינס|music|UK|4|2|4|2
Sting|סטינג|music|UK|5|2|5|1
Eminem|אמינם|music|USA|5|2|5|1
Jay-Z|ג'יי זי|music|USA|5|2|5|1
Kanye West|קניה ווסט|music|USA|5|2|5|1
Travis Scott|טראוויס סקוט|music|USA|4|2|4|2
Post Malone|פוסט מלון|music|USA|4|2|4|2
Snoop Dogg|סנופ דוג|music|USA|5|2|5|1
Dr Dre|ד"ר דרה|music|USA|4|2|4|2
50 Cent|פיפטי סנט|music|USA|4|2|4|2
Lil Wayne|ליל ויין|music|USA|4|2|4|2
Nicki Minaj|ניקי מינאז'|music|USA|5|2|5|1
Cardi B|קארדי בי|music|USA|4|2|4|2
Doja Cat|דוג'ה קאט|music|USA|4|2|4|2
Olivia Rodrigo|אוליביה רודריגו|music|USA|4|2|4|2
Sabrina Carpenter|סברינה קרפנטר|music|USA|4|2|4|2
Bad Bunny|באד באני|music|Puerto Rico|4|2|4|2
Shakira|שאקירה|music|Colombia|5|2|5|1
Ricky Martin|ריקי מרטין|music|Puerto Rico|5|2|4|2
Jennifer Lopez|ג'ניפר לופז|music|USA|5|2|5|1
Pitbull|פיטבול|music|USA|4|2|4|2
Luis Fonsi|לואיס פונסי|music|Puerto Rico|4|2|4|2
Daddy Yankee|דדי יאנקי|music|Puerto Rico|4|2|4|2
Bob Marley|בוב מארלי|music|Jamaica|5|2|5|1
Frank Sinatra|פרנק סינטרה|music|USA|5|2|5|1
Dean Martin|דין מרטין|music|USA|3|2|3|3
Sammy Davis Jr|סמי דייוויס ג'וניור|music|USA|3|2|3|3
Louis Armstrong|לואי ארמסטרונג|music|USA|5|2|5|1
Miles Davis|מיילס דייוויס|music|USA|4|2|4|2
Mozart|מוצרט|music|Austria|5|2|5|1
Beethoven|בטהובן|music|Germany|5|2|5|1
Bach|באך|music|Germany|5|2|5|1
Chopin|שופן|music|Poland|4|2|4|2
Tchaikovsky|צ'ייקובסקי|music|Russia|4|2|4|2
Vivaldi|ויולדי|music|Italy|4|2|4|2
Pavarotti|פאבארוטי|music|Italy|5|2|5|1
Andrea Bocelli|אנדריאה בוצ'לי|music|Italy|5|2|5|1
Cristiano Ronaldo|כריסטיאנו רונאלדו|football|Portugal|5|3|5|1
Lionel Messi|ליונל מסי|football|Argentina|5|3|5|1
Neymar|ניימאר|football|Brazil|5|2|5|1
Kylian Mbappe|קיליאן אמבפה|football|France|5|2|5|1
Erling Haaland|ארלינג הולאנד|football|Norway|5|2|5|1
Mohamed Salah|מוחמד סלאח|football|Egypt|5|3|5|1
Kevin De Bruyne|קווין דה בראונה|football|Belgium|4|2|4|2
Luka Modric|לוקה מודריץ'|football|Croatia|5|2|5|1
Robert Lewandowski|רוברט לבנדובסקי|football|Poland|5|2|5|1
Karim Benzema|כרים בנזמה|football|France|5|2|5|1
Zinedine Zidane|זינדין זידאן|football|France|5|3|5|1
David Beckham|דייוויד בקהאם|football|UK|5|2|5|1
Wayne Rooney|ויין רוני|football|UK|4|2|4|2
Steven Gerrard|סטיבן ג'רארד|football|UK|4|2|4|2
Frank Lampard|פרנק למפארד|football|UK|4|2|4|2
Thierry Henry|תיירי אנרי|football|France|5|2|5|1
Ronaldinho|רונאלדיניו|football|Brazil|5|2|5|1
Ronaldo Nazario|רונאלדו|football|Brazil|5|2|5|1
Pele|פלה|football|Brazil|5|2|5|1
Diego Maradona|דייגו מראדונה|football|Argentina|5|3|5|1
Andres Iniesta|אנדריס אינייסטה|football|Spain|4|2|4|2
Xavi Hernandez|צ'אבי|football|Spain|4|2|4|2
Sergio Ramos|סרחיו ראמוס|football|Spain|5|2|5|1
Iker Casillas|איקר קסיאס|football|Spain|4|2|4|2
Gianluigi Buffon|ג'אנלואיג'י בופון|football|Italy|4|2|4|2
Paolo Maldini|פאולו מאלדיני|football|Italy|4|2|4|2
Andrea Pirlo|אנדריאה פירלו|football|Italy|4|2|4|2
Francesco Totti|פרנצ'סקו טוטי|football|Italy|4|2|4|2
Gareth Bale|גארת' בייל|football|UK|4|2|4|2
Harry Kane|הארי קיין|football|UK|5|2|5|1
Jude Bellingham|ג'וד בלינגהאם|football|UK|5|2|5|1
Phil Foden|פיל פודן|football|UK|4|2|4|2
Bukayo Saka|בוקאיו סאקה|football|UK|4|2|4|2
Vinicius Junior|ויניסיוס ג'וניור|football|Brazil|5|2|5|1
Rodri|רודרי|football|Spain|4|2|4|2
Pedri|פדרי|football|Spain|4|2|4|2
Gavi|גאבי|football|Spain|4|2|4|2
Son Heung-min|סון הינג מין|football|South Korea|5|2|5|1
Sadio Mane|סאדיו מאנה|football|Senegal|4|2|4|2
Virgil van Dijk|וירג'יל ואן דייק|football|Netherlands|5|2|5|1
Manuel Neuer|מנואל נוייר|football|Germany|4|2|4|2
Thomas Muller|תומאס מילר|football|Germany|4|2|4|2
Mesut Ozil|מסוט אוזיל|football|Germany|4|3|4|2
Toni Kroos|טוני קרוס|football|Germany|4|2|4|2
Lebron James|לברון ג'יימס|basketball|USA|5|2|5|1
Stephen Curry|סטפן קרי|basketball|USA|5|2|5|1
Kevin Durant|קווין דוראנט|basketball|USA|5|2|5|1
Giannis Antetokounmpo|יאניס אדטוקומבו|basketball|Greece|5|2|5|1
Nikola Jokic|ניקולה יוקיץ'|basketball|Serbia|5|2|5|1
Luka Doncic|לוקה דונצ'יץ'|basketball|Slovenia|5|3|5|1
Anthony Davis|אנתוני דייוויס|basketball|USA|4|2|4|2
Kawhi Leonard|קוואי לנארד|basketball|USA|4|2|4|2
James Harden|ג'יימס הארדן|basketball|USA|4|2|4|2
Chris Paul|כריס פול|basketball|USA|4|2|4|2
Damian Lillard|דמיאן לילארד|basketball|USA|4|2|4|2
Jayson Tatum|ג'ייסון טייטום|basketball|USA|4|2|4|2
Joel Embiid|ג'ואל אמביד|basketball|Cameroon|4|2|4|2
Shaquille ONeal|שאקיל אוניל|basketball|USA|5|2|5|1
Kobe Bryant|קובי בראיינט|basketball|USA|5|2|5|1
Michael Jordan|מייקל ג'ורדן|basketball|USA|5|2|5|1
Magic Johnson|מג'יק ג'ונסון|basketball|USA|5|2|5|1
Larry Bird|לארי בירד|basketball|USA|4|2|4|2
Tim Duncan|טים דאנקן|basketball|USA|4|2|4|2
Dirk Nowitzki|דירק נוביצקי|basketball|Germany|4|2|4|2
Steve Nash|סטיב נאש|basketball|Canada|4|3|4|2
Tony Parker|טוני פארקר|basketball|France|4|2|4|2
Manu Ginobili|מנו ג'ינובילי|basketball|Argentina|4|2|4|2
Yao Ming|יאו מינג|basketball|China|4|2|4|2
Roger Federer|רוג'ר פדרר|tennis|Switzerland|5|2|5|1
Rafael Nadal|רפאל נדאל|tennis|Spain|5|2|5|1
Novak Djokovic|נובאק ג'וקוביץ'|tennis|Serbia|5|2|5|1
Serena Williams|סרינה ויליאמס|tennis|USA|5|2|5|1
Venus Williams|ווינוס ויליאמס|tennis|USA|4|2|4|2
Maria Sharapova|מריה שראפובה|tennis|Russia|5|2|5|1
Naomi Osaka|נאומי אוסקה|tennis|Japan|4|2|4|2
Carlos Alcaraz|קרלוס אלקרס|tennis|Spain|5|2|5|1
Jannik Sinner|יאניק סינר|tennis|Italy|4|2|4|2
Andy Murray|אנדי מאריי|tennis|UK|5|2|5|1
Pete Sampras|פיט סמפרס|tennis|USA|4|2|4|2
Andre Agassi|אנדרה אגאסי|tennis|USA|5|3|5|1
Steffi Graf|שטפי גראף|tennis|Germany|4|2|4|2
Martina Navratilova|מרטינה נברטילובה|tennis|USA|4|2|4|2
Lewis Hamilton|לואיס המילטון|formula1|UK|5|2|5|1
Max Verstappen|מקס ורסטאפן|formula1|Netherlands|5|2|5|1
Sebastian Vettel|סבסטיאן פטל|formula1|Germany|4|2|4|2
Michael Schumacher|מיכאל שומאכר|formula1|Germany|5|2|5|1
Ayrton Senna|איירטון סנה|formula1|Brazil|5|2|5|1
Fernando Alonso|פרננדו אלונסו|formula1|Spain|5|2|5|1
Charles Leclerc|צ'ארלס לקלרק|formula1|Monaco|4|2|4|2
Lando Norris|לנדו נוריס|formula1|UK|4|2|4|2
Carlos Sainz|קרלוס סאינס|formula1|Spain|4|2|4|2
Daniel Ricciardo|דניאל ריקארדו|formula1|Australia|4|2|4|2
Tiger Woods|טייגר וודס|athletics|USA|5|2|5|1
Usain Bolt|יוסיין בולט|athletics|Jamaica|5|2|5|1
Michael Phelps|מייקל פלפס|swimming|USA|5|2|5|1
Simone Biles|סימון ביילס|olympics|USA|5|2|5|1
Katie Ledecky|קייטי לדצקי|swimming|USA|4|2|4|2
Conor McGregor|קונור מקגרגור|mma|Ireland|5|2|5|1
Mike Tyson|מייק טייסון|boxing|USA|5|2|5|1
Muhammad Ali|מוחמד עלי|boxing|USA|5|2|5|1
Floyd Mayweather|פלויד מייוות'ר|boxing|USA|4|2|4|2
Manny Pacquiao|מני פאקיאו|boxing|Philippines|4|2|4|2
Cristiano|כריסטיאנו|football|Portugal|2|1|2|5
`.trim();

// More people continue in PART2 below via additional string concat
const ROWS2 = `
Barack Obama|ברק אובמה|politics|USA|5|3|5|1
Michelle Obama|מישל אובמה|politics|USA|5|2|5|1
Donald Trump|דונלד טראמפ|politics|USA|5|3|5|1
Joe Biden|ג'ו ביידן|politics|USA|5|3|5|1
Kamala Harris|קמלה האריס|politics|USA|5|2|5|1
Hillary Clinton|הילרי קלינטון|politics|USA|5|2|5|1
Bill Clinton|ביל קלינטון|politics|USA|5|2|5|1
George W Bush|ג'ורג' בוש|politics|USA|5|2|5|1
George H W Bush|ג'ורג' בוש האב|politics|USA|3|2|3|3
Ronald Reagan|רונלד רייגן|politics|USA|5|2|5|1
John F Kennedy|ג'ון פיצג'רלד קנדי|politics|USA|5|2|5|1
Abraham Lincoln|אברהם לינקולן|politics|USA|5|2|5|1
Franklin D Roosevelt|פרנקלין רוזוולט|politics|USA|4|2|4|2
Winston Churchill|וינסטון צ'רצ'יל|politics|UK|5|3|5|1
Margaret Thatcher|מרגרט תאצ'ר|politics|UK|5|2|5|1
Queen Elizabeth II|אליזבת השנייה|royalty|UK|5|2|5|1
King Charles III|צ'ארלס השלישי|royalty|UK|5|2|5|1
Prince William|הנסיך ויליאם|royalty|UK|5|2|5|1
Princess Kate|קייט מידלטון|royalty|UK|5|2|5|1
Prince Harry|הנסיך הארי|royalty|UK|5|2|5|1
Meghan Markle|מייגן מרקל|royalty|USA|5|2|5|1
Princess Diana|דיאנה הנסיכה|royalty|UK|5|2|5|1
Vladimir Putin|ולדימיר פוטין|politics|Russia|5|3|5|1
Volodymyr Zelenskyy|וולודימיר זלנסקי|politics|Ukraine|5|3|5|1
Angela Merkel|אנגלה מרקל|politics|Germany|5|2|5|1
Emmanuel Macron|עמנואל מקרון|politics|France|5|2|5|1
Nicolas Sarkozy|ניקולא סרקוזי|politics|France|4|2|4|2
Justin Trudeau|ג'סטין טרודו|politics|Canada|5|2|5|1
Narendra Modi|נרנדרה מודי|politics|India|5|2|5|1
Xi Jinping|שי ג'ינפינג|politics|China|5|2|5|1
Kim Jong Un|קים ג'ונג און|politics|North Korea|5|2|5|1
Jacinda Ardern|ג'סינדה ארדרן|politics|New Zealand|4|2|4|2
Nelson Mandela|נלסון מנדלה|politics|South Africa|5|2|5|1
Mahatma Gandhi|מהטמה גנדי|politics|India|5|2|5|1
Martin Luther King Jr|מרטין לותר קינג|politics|USA|5|2|5|1
Malcolm X|מאלקולם אקס|politics|USA|4|2|4|2
Che Guevara|צ'ה גווארה|politics|Argentina|5|2|5|1
Fidel Castro|פידל קסטרו|politics|Cuba|5|2|5|1
Josef Stalin|יוסיף סטאלין|history|Russia|5|2|5|1
Adolf Hitler|אדולף היטלר|history|Germany|5|3|5|1
Napoleon Bonaparte|נפוליאון בונפרטה|history|France|5|2|5|1
Julius Caesar|יוליוס קיסר|history|Italy|5|2|5|1
Cleopatra|קליאופטרה|history|Egypt|5|2|5|1
Alexander the Great|אלכסנדר הגדול|history|Greece|5|2|5|1
Genghis Khan|ג'ינגיס חאן|history|Mongolia|4|2|4|2
Joan of Arc|ז'אן ד'ארק|history|France|4|2|4|2
Christopher Columbus|כריסטופר קולומבוס|history|Italy|5|2|5|1
Marco Polo|מרקו פולו|history|Italy|4|2|4|2
William Shakespeare|ויליאם שייקספיר|literature|UK|5|2|5|1
Charles Dickens|צ'ארלס דיקנס|literature|UK|4|2|4|2
Jane Austen|ג'יין אוסטן|literature|UK|4|2|4|2
Mark Twain|מארק טוויין|literature|USA|4|2|4|2
Ernest Hemingway|ארנסט המינגוויי|literature|USA|4|2|4|2
J K Rowling|ג'יי קיי רולינג|literature|UK|5|2|5|1
George Orwell|ג'ורג' אורוול|literature|UK|4|2|4|2
J R R Tolkien|ג'יי אר אר טולקין|literature|UK|5|2|5|1
Agatha Christie|אגאתה כריסטי|literature|UK|5|2|5|1
Stephen King|סטיבן קינג|literature|USA|5|2|5|1
Dan Brown|דן בראון|literature|USA|4|2|4|2
Haruki Murakami|הארוקי מורקאמי|literature|Japan|4|2|4|2
Gabriel Garcia Marquez|גבריאל גארסיה מארקס|literature|Colombia|4|2|4|2
Leo Tolstoy|לב טולסטוי|literature|Russia|4|2|4|2
Fyodor Dostoevsky|פיודור דוסטויבסקי|literature|Russia|4|2|4|2
Victor Hugo|ויקטור הוגו|literature|France|4|2|4|2
Franz Kafka|פרנץ קפקא|literature|Czechia|4|3|4|2
Anne Frank|אנה פרנק|literature|Netherlands|5|4|5|1
Maya Angelou|מאיה אנג'לו|literature|USA|3|2|3|3
Pope Francis|האפיפיור פרנציסקוס|religion|Argentina|5|3|5|1
Dalai Lama|הדלאי לאמה|religion|Tibet|5|2|5|1
Mother Teresa|האם תרזה|religion|Albania|5|2|5|1
Jesus|ישו|religion|Israel|5|5|5|1
Moses|משה|religion|Israel|5|5|5|1
King David|דוד המלך|religion|Israel|5|5|5|1
King Solomon|שלמה המלך|religion|Israel|5|5|5|1
Abraham|אברהם|religion|Israel|5|5|5|1
Muhammad|מוחמד|religion|Saudi Arabia|5|3|5|1
Buddha|בודהה|religion|India|5|2|5|1
Greta Thunberg|גרטה תונברג|activism|Sweden|5|2|5|1
Malala Yousafzai|מלאלה יוספזאי|activism|Pakistan|5|2|5|1
Rosa Parks|רוזה פארקס|activism|USA|4|2|4|2
Ruth Bader Ginsburg|רות ביידר גינסבורג|politics|USA|4|3|4|2
Alexandria Ocasio-Cortez|אלכסנדריה אוקסיו קורטז|politics|USA|3|2|3|3
Bernie Sanders|ברני סנדרס|politics|USA|4|2|4|2
Arnold Schwarzenegger|ארנולד שוורצנגר|actors|Austria|5|2|5|1
Sylvester Stallone|סילבסטר סטאלון|actors|USA|5|2|5|1
Jean-Claude Van Damme|ז'אן קלוד ואן דאם|actors|Belgium|5|2|5|1
Jackie Chan|ג'קי צ'אן|actors|China|5|2|5|1
Jet Li|ג'ט לי|actors|China|4|2|4|2
Bruce Lee|ברוס לי|actors|USA|5|2|5|1
Chuck Norris|צ'אק נוריס|actors|USA|5|2|5|1
Steven Seagal|סטיבן סיגל|actors|USA|4|2|4|2
Keanu|קיאנו|actors|Canada|2|1|2|5
Mel Gibson|מל גיבסון|actors|USA|5|2|5|1
Russell Crowe|ראסל קרו|actors|Australia|5|2|5|1
Hugh Grant|יו גרנט|actors|UK|5|2|5|1
Colin Firth|קולין פירת'|actors|UK|4|2|4|2
Jude Law|ג'וד לאו|actors|UK|4|2|4|2
Ewan McGregor|יואן מקגרגור|actors|UK|5|2|5|1
Liam Neeson|ליאם ניסן|actors|Ireland|5|2|5|1
Ralph Fiennes|ראלף פיינס|actors|UK|4|2|4|2
Gary Oldman|גארי אולדמן|actors|UK|4|2|4|2
Michael Caine|מייקל קיין|actors|UK|4|2|4|2
Alfred Hitchcock|אלפרד היצ'קוק|film|UK|5|2|5|1
Steven Spielberg|סטיבן ספילברג|film|USA|5|3|5|1
Martin Scorsese|מרטין סקורסזה|film|USA|5|2|5|1
Quentin Tarantino|קוונטין טרנטינו|film|USA|5|2|5|1
Christopher Nolan|כריסטופר נולאן|film|UK|5|2|5|1
James Cameron|ג'יימס קמרון|film|Canada|5|2|5|1
Ridley Scott|רידלי סקוט|film|UK|4|2|4|2
George Lucas|ג'ורג' לוקאס|film|USA|5|2|5|1
Peter Jackson|פיטר ג'קסון|film|New Zealand|5|2|5|1
Francis Ford Coppola|פרנסיס פורד קופולה|film|USA|4|2|4|2
Woody Allen|וודי אלן|film|USA|5|3|5|1
Wes Anderson|ווס אנדרסון|film|USA|4|2|4|2
Guillermo del Toro|גיירמו דל טורו|film|Mexico|4|2|4|2
Denis Villeneuve|דני וילנב|film|Canada|4|2|4|2
Greta Gerwig|גרטה גרוויג|film|USA|4|2|4|2
Jordan Peele|ג'ורדן פיל|film|USA|4|2|4|2
 Ava DuVernay|אווה דוברנאי|film|USA|3|2|3|3
Spike Lee|ספייק לי|film|USA|4|2|4|2
Clint Eastwood|קלינט איסטווד|actors|USA|5|2|5|1
John Wayne|ג'ון ויין|actors|USA|4|2|4|2
Marilyn Monroe|מרילין מונרו|actors|USA|5|2|5|1
Audrey Hepburn|אודרי הפבורן|actors|UK|5|2|5|1
Elizabeth Taylor|אליזבת טיילור|actors|UK|5|2|5|1
Grace Kelly|גרייס קלי|actors|USA|4|2|4|2
Humphrey Bogart|המפרי בוגרט|actors|USA|4|2|4|2
Cary Grant|קארי גרנט|actors|USA|3|2|3|3
James Dean|ג'יימס דין|actors|USA|5|2|5|1
Marlon Brando|מארלון ברנדו|actors|USA|5|2|5|1
Paul Newman|פול ניומן|actors|USA|4|2|4|2
Robert Redford|רוברט רדפורד|actors|USA|4|2|4|2
Jack Nicholson|ג'ק ניקולסון|actors|USA|5|2|5|1
Gene Hackman|ג'ין הקמן|actors|USA|4|2|4|2
Dustin Hoffman|דסטין הופמן|actors|USA|5|2|5|1
Harrison|האריסון|actors|USA|2|1|2|5
`.trim();

const ROWS3 = `
// Israeli & Jewish diaspora celebs not in v1 — high israeli_relevance
Ohad Knoller|אוהד קנולר|actors|Israel|4|5|2|2
Yuval Segal|יובל סגל|actors|Israel|4|5|2|2
Lior Ashkenazi|ליאור אשכנזי|actors|Israel|5|5|2|1
Alon Aboutboul|אלון אבוטבול|actors|Israel|4|5|2|2
Tzachi Halevy|צחי הלוי|actors|Israel|5|5|3|1
Shira Haas|שירה האס|actors|Israel|5|5|4|1
Ayelet Zurer|איילת זורר|actors|Israel|5|5|3|1
Moran Atias|מורן אטיאס|actors|Israel|4|5|2|2
Esti Ginzburg|אסתי גינזבורג|fashion|Israel|4|5|2|2
Shlomi Koriat|שלומי קוריאט|comedy|Israel|4|5|1|2
Eli Finish|אלי פיניש|comedy|Israel|4|5|1|2
Dov Navon|דב נבון|comedy|Israel|4|5|1|2
Tal Friedman|טל פרידמן|comedy|Israel|5|5|1|1
Mariano Idelman|מריאנו אידלמן|comedy|Israel|4|5|1|2
Orna Banai|אורנה בנאי|comedy|Israel|5|5|1|1
Yael Bar Zohar|יעל בר זוהר|television|Israel|5|5|1|1
Paz Manheimer|פז מנהיימר|television|Israel|3|5|1|3
Guy Zu-Aretz|גיא זו ארץ|actors|Israel|4|5|1|2
Yehuda Levi|יהודה לוי|actors|Israel|5|5|2|1
Agam Rudberg|אגם רודברג|actors|Israel|4|5|1|2
Daniel Litman|דניאל ליטמן|actors|Israel|3|5|1|3
Michael Aloni|מיכאל אלוני|actors|Israel|5|5|3|1
Itay Tiran|איתי טיראן|actors|Israel|4|5|2|2
Ania Bukstein|אניה בוקשטיין|actors|Israel|4|5|2|2
Rona-Lee Shimon|רונה לי שמעון|actors|Israel|4|5|3|2
Sasha Roiz|סשה רויז|actors|Canada|3|4|3|3
Gene Simmons|ג'ין סימונס|music|USA|5|4|5|1
Paul Stanley|פול סטנלי|music|USA|4|3|4|2
Leonard Cohen|לאונרד כהן|music|Canada|5|4|5|1
Bob Dylan Robert|בוב דילן|music|USA|5|3|5|1
Neil Diamond|ניל דיימונד|music|USA|4|3|4|2
Barbra Streisand|ברברה סטרייסנד|music|USA|5|4|5|1
Billy Crystal|בילי קריסטל|comedy|USA|5|3|5|1
Jerry Seinfeld|ג'רי סיינפלד|comedy|USA|5|3|5|1
Larry David|לארי דייוויד|comedy|USA|5|3|5|1
Sarah Silverman|שרה סילברמן|comedy|USA|4|3|4|2
Amy Schumer|איימי שומר|comedy|USA|4|2|4|2
Jon Stewart|ג'ון סטיוארט|comedy|USA|5|3|5|1
Seth Meyers|סת' מאיירס|comedy|USA|3|2|3|3
Andy Samberg|אנדי סמברג|comedy|USA|4|2|4|2
Tiffany Haddish|טיפאני האדיש|comedy|USA|3|2|3|3
Kevin Hart|קווין הארט|comedy|USA|5|2|5|1
Chris Rock|כריס רוק|comedy|USA|5|2|5|1
Dave Chappelle|דייב שאפל|comedy|USA|5|2|5|1
Ricky Gervais|ריקי ג'רווייס|comedy|UK|5|2|5|1
Sacha Baron Cohen|סשה ברון כהן|comedy|UK|5|4|5|1
Rowan Atkinson|רואן אטקינסון|comedy|UK|5|2|5|1
Mr Bean|מיסטר בין|comedy|UK|5|2|5|1
John Cleese|ג'ון קליז|comedy|UK|4|2|4|2
Eric Idle|אריק איידל|comedy|UK|3|2|3|3
Michael Palin|מייקל פיילין|comedy|UK|3|2|3|3
Steve Martin|סטיב מרטין|comedy|USA|5|2|5|1
Martin Short|מרטין שורט|comedy|Canada|3|2|3|3
Tina Fey|טינה פיי|comedy|USA|5|2|5|1
Amy Poehler|איימי פוהלר|comedy|USA|4|2|4|2
Kristen Wiig|קריסטן ויג|comedy|USA|4|2|4|2
Melissa McCarthy|מליסה מקארתי|comedy|USA|5|2|5|1
Kate McKinnon|קייט מקינון|comedy|USA|3|2|3|3
Bill Hader|ביל היידר|comedy|USA|4|2|4|2
John Mulaney|ג'ון מולייני|comedy|USA|3|2|3|3
Hasan Minhaj|חסן מינהאג'|comedy|USA|3|2|3|3
Bo Burnham|בו ברנהאם|comedy|USA|4|2|4|2
Ali G|עלי ג'י|comedy|UK|4|3|4|2
Borat|בוראט|comedy|UK|5|3|5|1
Bruno|ברונו|comedy|UK|3|2|3|3
`.trim();

// Large additional famous-people block (compact)
const ROWS4 = `
Usher|אשר|music|USA|5|2|5|1
Chris Brown|כריס בראון|music|USA|4|2|4|2
Justin Timberlake|ג'סטין טימברלייק|music|USA|5|2|5|1
Britney Spears|בריטני ספירס|music|USA|5|2|5|1
Christina Aguilera|כריסטינה אגילרה|music|USA|5|2|5|1
Gwen Stefani|גוון סטפאני|music|USA|4|2|4|2
Pink|פינק|music|USA|5|2|5|1
Kelly Clarkson|קלי קלארקסון|music|USA|4|2|4|2
John Mayer|ג'ון מאייר|music|USA|4|2|4|2
Alicia Keys|אלישה קיז|music|USA|5|2|5|1
John Legend|ג'ון לג'נד|music|USA|5|2|5|1
Pharrell Williams|פארל ויליאמס|music|USA|4|2|4|2
Katy|קייטי|music|USA|2|1|2|5
Lorde|לורד|music|New Zealand|4|2|4|2
Halsey|הולזי|music|USA|4|2|4|2
Lana Del Rey|לאנה דל ריי|music|USA|5|2|5|1
The Weeknd Abel|דה ויקנד|music|Canada|5|2|5|1
Sia|סיה|music|Australia|5|2|5|1
Iggy Azalea|איגי אזליה|music|Australia|3|2|3|3
Ellie Goulding|אלי גולדינג|music|UK|4|2|4|2
Calvin Harris|קלווין האריס|music|UK|5|2|5|1
David Guetta|דייוויד גטה|music|France|5|2|5|1
Avicii|אביצ'י|music|Sweden|5|2|5|1
Marshmello|מארשמלו|music|USA|4|2|4|2
Skrillex|סקרילקס|music|USA|4|2|4|2
Deadmau5|דדמאוס|music|Canada|3|2|3|3
Tiesto|טייסטו|music|Netherlands|4|2|4|2
Armin van Buuren|ארמין ואן ביורן|music|Netherlands|4|2|4|2
Martin Garrix|מרטין גאריקס|music|Netherlands|4|2|4|2
Kygo|קייגו|music|Norway|4|2|4|2
Zedd|זד|music|Germany|3|2|3|3
Diplo|דיפלו|music|USA|3|2|3|3
Major Lazer|מייג'ור לייזר|music|USA|3|2|3|3
Blackpink Jennie|ג'ני|music|South Korea|4|2|4|2
BTS Jungkook|ג'ונגקוק|music|South Korea|5|2|5|1
BTS RM|אר אם|music|South Korea|4|2|4|2
BTS V|וי|music|South Korea|4|2|4|2
BTS Jimin|ג'ימין|music|South Korea|4|2|4|2
BTS Suga|שוגה|music|South Korea|4|2|4|2
BTS Jin|ג'ין|music|South Korea|4|2|4|2
BTS J Hope|ג'יי הופ|music|South Korea|4|2|4|2
PSY|פסי|music|South Korea|5|2|5|1
Blackpink Lisa|ליסה|music|Thailand|4|2|4|2
Blackpink Rosé|רוזה|music|South Korea|4|2|4|2
Blackpink Jisoo|ג'יסו|music|South Korea|4|2|4|2
IU|אייו|music|South Korea|3|2|3|3
G Dragon|ג'י דרגון|music|South Korea|3|2|3|3
Twitch Ninja|נינג'ה|entertainment|USA|3|2|3|3
PewDiePie|פיודיפאי|entertainment|Sweden|5|2|5|1
MrBeast|מיסטר ביסט|entertainment|USA|5|2|5|1
KSI|קיי אס איי|entertainment|UK|4|2|4|2
Logan Paul|לוגן פול|entertainment|USA|4|2|4|2
Jake Paul|ג'ייק פול|entertainment|USA|4|2|4|2
Charli DAmelio|צ'ארלי דאמליו|entertainment|USA|4|2|4|2
Addison Rae|אדיסון ריי|entertainment|USA|3|2|3|3
Kylie Jenner|קיילי ג'נר|celebrity|USA|5|2|5|1
Kim Kardashian|קים קרדשיאן|celebrity|USA|5|2|5|1
Khloe Kardashian|קלואי קרדשיאן|celebrity|USA|4|2|4|2
Kourtney Kardashian|קורטני קרדשיאן|celebrity|USA|4|2|4|2
Kendall Jenner|קנדל ג'נר|celebrity|USA|5|2|5|1
Kris Jenner|קריס ג'נר|celebrity|USA|4|2|4|2
Paris Hilton|פאריס הילטון|celebrity|USA|5|2|5|1
Nicole Richie|ניקול ריצ'י|celebrity|USA|3|2|3|3
Gigi Hadid|ג'יג'י חדיד|fashion|USA|5|3|5|1
Bella Hadid|בלה חדיד|fashion|USA|5|3|5|1
Kendall|קנדל|fashion|USA|2|1|2|5
Naomi Campbell|נעמי קמפבל|fashion|UK|5|2|5|1
Cindy Crawford|סינדי קרופורד|fashion|USA|5|2|5|1
Heidi Klum|היידי קלום|fashion|Germany|5|2|5|1
Gisele Bundchen|ז'יזל בונדשן|fashion|Brazil|5|2|5|1
Kate Moss|קייט מוס|fashion|UK|5|2|5|1
Tyra Banks|טירה בנקס|fashion|USA|4|2|4|2
Coco Chanel|קוקו שאנל|fashion|France|5|2|5|1
Giorgio Armani|ג'ורג'יו ארמני|fashion|Italy|5|2|5|1
Donatella Versace|דונטלה ורסצ'ה|fashion|Italy|4|2|4|2
Karl Lagerfeld|קארל לגרפלד|fashion|Germany|5|2|5|1
Ralph Lauren|ראלף לורן|fashion|USA|4|2|4|2
Vera Wang|ורה ואנג|fashion|USA|3|2|3|3
Gordon Ramsay|גורדון רמזי|food|UK|5|2|5|1
Jamie Oliver|ג'יימי אוליבר|food|UK|5|2|5|1
Anthony Bourdain|אנתוני בורדיין|food|USA|5|2|5|1
Julia Child|ג'וליה צ'יילד|food|USA|3|2|3|3
Guy Fieri|גיי פיירי|food|USA|4|2|4|2
Martha Stewart|מארתה סטיוארט|food|USA|4|2|4|2
Nigella Lawson|ניג'לה לוסון|food|UK|3|2|3|3
Massimo Bottura|מסימו בוטורה|food|Italy|2|1|2|4
Rene Redzepi|רנה רדזפי|food|Denmark|2|1|2|4
Wolfgang Puck|וולפגנג פאק|food|Austria|3|2|3|3
`.trim();

function parseBlock(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("//")) continue;
    const parts = t.split("|");
    if (parts.length < 8) {
      console.warn("bad row", t);
      continue;
    }
    const [
      subject,
      answer_hebrew,
      category,
      country,
      recognition,
      israeli_relevance,
      global_relevance,
      difficulty,
    ] = parts;
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

const EXTRA = parseBlock(`
Paul Rudd Paul|פול ראד|actors|USA|4|2|4|2
Henry Cavill|הנרי קאוויל|actors|UK|5|2|5|1
Jason Momoa|ג'ייסון מומואה|actors|USA|5|2|5|1
Millie Bobby Brown|מילי בובי בראון|actors|UK|5|2|5|1
Finn Wolfhard|פין וולפהארד|actors|Canada|4|2|4|2
Noah Schnapp|נואה שנאפ|actors|USA|3|3|3|3
Winona Ryder|וינונה ריידר|actors|USA|4|2|4|2
David Harbour|דייוויד הארבור|actors|USA|4|2|4|2
Gaten Matarazzo|גייטן מטאראצו|actors|USA|3|2|3|3
Caleb McLaughlin|קיילב מקלוגלין|actors|USA|3|2|3|3
Sadie Sink|סיידי סינק|actors|USA|4|2|4|2
Natalia Dyer|נטליה דייר|actors|USA|3|2|3|3
Joe Keery|ג'ו קירי|actors|USA|4|2|4|2
Maya Hawke|מאיה הוק|actors|USA|3|2|3|3
Jamie Campbell Bower|ג'יימי קמפבל באואר|actors|UK|3|2|3|3
Tom Hiddleston|טום הידלסטון|actors|UK|5|2|5|1
Paul Bettany|פול בטאני|actors|UK|3|2|3|3
Anthony Mackie|אנתוני מקי|actors|USA|4|2|4|2
Sebastian Stan|סבסטיאן סטן|actors|Romania|4|2|4|2
Tom Hardy|טום הארדי|actors|UK|5|2|5|1
Cillian Murphy|סיליאן מרפי|actors|Ireland|5|2|5|1
Emily Blunt|אמילי בלאנט|actors|UK|5|2|5|1
Rachel McAdams|רייצ'ל מקאדמס|actors|Canada|5|2|5|1
Amy Adams|איימי אדמס|actors|USA|5|2|5|1
Jessica Chastain|ג'סיקה צ'סטיין|actors|USA|5|2|5|1
Rosamund Pike|רוזמונד פייק|actors|UK|4|2|4|2
Rebecca Ferguson|רבקה פרגוסון|actors|Sweden|4|2|4|2
Saoirse Ronan|סירשה רונאן|actors|Ireland|4|2|4|2
Brie Larson|ברי לארסון|actors|USA|5|2|5|1
Tessa Thompson|טסה תומפסון|actors|USA|3|2|3|3
Danai Gurira|דנאי גורירה|actors|USA|3|2|3|3
Letitia Wright|לטישה רייט|actors|UK|3|2|3|3
Angela Bassett|אנג'לה באסט|actors|USA|4|2|4|2
Forest Whitaker|פורסט ויטאקר|actors|USA|4|2|4|2
Mahershala Ali|מהרשלה עלי|actors|USA|4|2|4|2
Chiwetel Ejiofor|צ'יוטל אג'יופור|actors|UK|3|2|3|3
Dev Patel|דב פאטל|actors|UK|4|2|4|2
Rami Malek|ראמי מאלק|actors|USA|5|3|5|1
Edward Norton|אדוארד נורטון|actors|USA|5|2|5|1
Ralph Macchio|ראלף מאצ'יו|actors|USA|4|2|4|2
William Zabka|ויליאם זאבקה|actors|USA|3|2|3|3
Xolo Mariduena|קסולו מרידואניה|actors|USA|3|2|3|3
Mary Elizabeth Winstead|מרי אליזבת וינסטד|actors|USA|3|2|3|3
Rhea Seehorn|ריאה סיהורן|actors|USA|3|2|3|3
Giancarlo Esposito|ג'יאנקרלו אספוסיטו|actors|USA|4|2|4|2
Jonathan Banks|ג'ונתן בנקס|actors|USA|3|2|3|3
Anna Gunn|אנה גאן|actors|USA|3|2|3|3
Dean Norris|דין נוריס|actors|USA|3|2|3|3
Krysten Ritter|קריסטן ריטר|actors|USA|3|2|3|3
Charlie Cox|צ'ארלי קוקס|actors|UK|4|2|4|2
Vincent DOnofrio|וינסנט ד'אונופריו|actors|USA|3|2|3|3
Jon Bernthal|ג'ון ברנתאל|actors|USA|4|2|4|2
Deborah Ann Woll|דבורה אן וול|actors|USA|3|2|3|3
Elodie Yung|אלדי יונג|actors|France|2|2|2|4
Finn Jones|פין ג'ונס|actors|UK|2|2|2|4
Mike Colter|מייק קולטר|actors|USA|3|2|3|3
`);

// Expand with more solid famous names (batch of high-recognition)
const ROWS5 = `
Oprah|אופרה|media|USA|5|2|5|1
Ellen|אלן|media|USA|4|2|4|2
Jimmy Kimmel|ג'ימי קימל|media|USA|5|2|5|1
Anderson Cooper|אנדרסון קופר|media|USA|4|2|4|2
Rachel Maddow|רייצ'ל מדו|media|USA|3|2|3|3
Tucker Carlson|טאקר קרלסון|media|USA|4|2|4|2
Sean Hannity|שון האניטי|media|USA|3|2|3|3
Wolf Blitzer|וולף בליצר|media|USA|4|4|4|2
Christiane Amanpour|כריסטיאן אמאנפור|media|UK|3|2|3|3
Barbara Walters|ברברה וולטרס|media|USA|4|2|4|2
Walter Cronkite|וולטר קרונקייט|media|USA|3|2|3|3
Larry King|לארי קינג|media|USA|5|3|5|1
Howard Stern|הווארד סטרן|media|USA|4|3|4|2
Alex Jones|אלכס ג'ונס|media|USA|3|2|3|3
Jordan Peterson|ג'ורדן פיטרסון|media|Canada|4|2|4|2
Ben Shapiro|בן שפירו|media|USA|4|4|4|2
Sam Harris|סם האריס|media|USA|3|2|3|3
Neil deGrasse Tyson|ניל דה גראס טייסון|science|USA|5|2|5|1
Carl Sagan|קארל סייגן|science|USA|4|2|4|2
Richard Feynman|ריצ'רד פיינמן|science|USA|4|2|4|2
Jane Goodall|ג'יין גודול|science|UK|5|2|5|1
David Attenborough|דייוויד אטנבורו|science|UK|5|2|5|1
Bill Nye|ביל ניי|science|USA|4|2|4|2
Brian Cox|בריאן קוקס|science|UK|3|2|3|3
Michio Kaku|מיצ'יו קאקו|science|USA|3|2|3|3
Alan Turing|אלן טיורינג|science|UK|5|2|5|1
Ada Lovelace|עדה לאבלייס|science|UK|3|2|3|3
Grace Hopper|גרייס הופר|science|USA|2|2|2|4
Tim Berners-Lee|טים ברנרס לי|technology|UK|4|2|4|2
Linus Torvalds|לינוס טורבלדס|technology|Finland|4|2|4|2
Mark Cuban|מארק קובן|business|USA|4|2|4|2
Elon|אילון|technology|USA|3|2|3|3
Richard Branson|ריצ'רד ברנסון|business|UK|5|2|5|1
Howard Schultz|הווארד שולץ|business|USA|3|2|3|3
Phil Knight|פיל נייט|business|USA|3|2|3|3
Indra Nooyi|אינדרה נויי|business|India|2|2|2|4
Sheryl Sandberg|שריל סנדברג|business|USA|4|3|4|2
Susan Wojcicki|סוזן וויצ'יצקי|technology|USA|3|2|3|3
Marissa Mayer|מריסה מאייר|technology|USA|3|2|3|3
Ginni Rometty|ג'יני רומטי|technology|USA|2|2|2|4
Jack Dorsey|ג'ק דורסי|technology|USA|4|2|4|2
Evan Spiegel|אוון שפיגל|technology|USA|3|2|3|3
Brian Chesky|בריאן צ'סקי|technology|USA|3|2|3|3
Travis Kalanick|טראוויס קלאניק|technology|USA|3|2|3|3
Reed Hastings|ריד הייסטינגס|technology|USA|3|2|3|3
Jensen Huang|ג'נסן הואנג|technology|Taiwan|4|2|4|2
Sam Altman|סם אלטמן|technology|USA|5|3|5|1
Demis Hassabis|דמיס הסאביס|technology|UK|3|2|3|3
Ilya Sutskever|איליה סוצקבר|technology|Canada|3|3|3|3
Geoffrey Hinton|ג'פרי הינטון|technology|Canada|3|2|3|3
Yann LeCun|יאן לקון|technology|France|3|2|3|3
Andrew Ng|אנדרו אנג|technology|USA|3|2|3|3
Fei-Fei Li|פיי פיי לי|technology|USA|2|2|2|4
`.trim();

const ROWS6 = `
// Sports stars batch 2
Cristiano Ronaldo CR7|כריסטיאנו רונאלדו|football|Portugal|5|3|5|1
Lionel Messi GOAT|ליונל מסי|football|Argentina|5|3|5|1
Erling|ארלינג|football|Norway|2|1|2|5
Antoine Griezmann|אנטואן גריזמן|football|France|4|2|4|2
Paul Pogba|פול פוגבה|football|France|4|2|4|2
NGolo Kante|אנז'ולו קאנטה|football|France|4|2|4|2
Olivier Giroud|אוליביה ז'ירו|football|France|3|2|3|3
Hugo Lloris|הוגו לוריס|football|France|3|2|3|3
Kylian|קיליאן|football|France|3|2|3|3
Jamal Musiala|ג'מאל מוסיאלה|football|Germany|4|2|4|2
Joshua Kimmich|יושואה קימיך|football|Germany|4|2|4|2
Ilkay Gundogan|אילקאי גונדואן|football|Germany|3|2|3|3
Marco Reus|מרקו רויס|football|Germany|4|2|4|2
Mats Hummels|מאטס הומלס|football|Germany|3|2|3|3
Manuel|מנואל|football|Germany|2|1|2|5
Alphonso Davies|אלפונסו דייוויס|football|Canada|4|2|4|2
Harry Maguire|הארי מגווייר|football|UK|4|2|4|2
Marcus Rashford|מארקוס רשפורד|football|UK|4|2|4|2
Raheem Sterling|רהים סטרלינג|football|UK|4|2|4|2
Jack Grealish|ג'ק גריליש|football|UK|4|2|4|2
Declan Rice|דקלן רייס|football|UK|4|2|4|2
Trent Alexander-Arnold|טרנט אלכסנדר ארנולד|football|UK|4|2|4|2
Mohamed|מוחמד|football|Egypt|2|1|2|5
Victor Osimhen|ויקטור אוסימהן|football|Nigeria|4|2|4|2
Victor|ויקטור|football|Nigeria|2|1|2|5
Khvicha Kvaratskhelia|חוויצ'ה קווארצחליה|football|Georgia|3|2|3|3
Lautaro Martinez|לאוטארו מרטינז|football|Argentina|4|2|4|2
Julian Alvarez|חוליאן אלברס|football|Argentina|4|2|4|2
Angel Di Maria|אנחל די מריה|football|Argentina|5|2|5|1
Paulo Dybala|פאולו דיבלה|football|Argentina|4|2|4|2
Sergio Aguero|סרחיו אגוארו|football|Argentina|5|2|5|1
Gonzalo Higuain|גונסאלו היגוואין|football|Argentina|3|2|3|3
Luis Suarez|לואיס סוארס|football|Uruguay|5|2|5|1
Edinson Cavani|אדינסון קוואני|football|Uruguay|4|2|4|2
Diego Forlan|דייגו פורלאן|football|Uruguay|3|2|3|3
James Rodriguez|חאמס רודריגס|football|Colombia|4|2|4|2
Radamel Falcao|רדאמל פלקאו|football|Colombia|4|2|4|2
Eden Hazard|אדן האזרד|football|Belgium|5|2|5|1
Romelu Lukaku|רומלו לוקאקו|football|Belgium|4|2|4|2
Thibaut Courtois|תיבו קורטואה|football|Belgium|4|2|4|2
Christian Eriksen|כריסטיאן אריקסן|football|Denmark|4|2|4|2
Kaspar Schmeichel|קאספר שמייכל|football|Denmark|3|2|3|3
Robert|רוברט|football|Poland|2|1|2|5
Wojciech Szczesny|וויצ'ך שצ'סני|football|Poland|3|2|3|3
Jan Oblak|יאן אובלק|football|Slovenia|4|2|4|2
Luka|לוקה|football|Croatia|3|2|3|3
Ivan Rakitic|איוואן ראקיטיץ'|football|Croatia|3|2|3|3
Mario Mandzukic|מריו מנדז'וקיץ'|football|Croatia|3|2|3|3
Zlatan Ibrahimovic|זלאטן איברהימוביץ'|football|Sweden|5|2|5|1
Henrik Larsson|הנריק לארסון|football|Sweden|3|2|3|3
Victor Lindelof|ויקטור לינדלוף|football|Sweden|3|2|3|3
Gareth|גארת'|football|UK|2|1|2|5
Ryan Giggs|ראיין גיגס|football|UK|4|2|4|2
Paul Scholes|פול סקולס|football|UK|4|2|4|2
Eric Cantona|אריק קנטונה|football|France|4|2|4|2
George Best|ג'ורג' בסט|football|UK|4|2|4|2
Bobby Charlton|בובי צ'רלטון|football|UK|4|2|4|2
Johan Cruyff|יוהאן קרויף|football|Netherlands|5|2|5|1
Marco van Basten|מרקו ואן באסטן|football|Netherlands|4|2|4|2
Ruud Gullit|רוד חוליט|football|Netherlands|4|2|4|2
Dennis Bergkamp|דניס ברגקאמפ|football|Netherlands|4|2|4|2
Arjen Robben|אריין רובן|football|Netherlands|4|2|4|2
Wesley Sneijder|וסלי סניידר|football|Netherlands|4|2|4|2
Robin van Persie|רובין ואן פרסי|football|Netherlands|4|2|4|2
Memphis Depay|ממפיס דפאי|football|Netherlands|3|2|3|3
Frenkie de Jong|פרנקי דה יונג|football|Netherlands|4|2|4|2
Matthijs de Ligt|מאטייס דה ליכט|football|Netherlands|4|2|4|2
`.trim();

const ROWS7 = `
// Basketball / tennis / other sports + more celebs
Ja Morant|ג'ה מוראנט|basketball|USA|4|2|4|2
Zion Williamson|זיון ויליאמסון|basketball|USA|4|2|4|2
Trae Young|טריי יאנג|basketball|USA|4|2|4|2
Luka|לוקה דונצ'יץ'|basketball|Slovenia|5|3|5|1
Devin Booker|דווין בוקר|basketball|USA|4|2|4|2
Donovan Mitchell|דונובן מיטשל|basketball|USA|4|2|4|2
Jimmy Butler|ג'ימי באטלר|basketball|USA|4|2|4|2
Draymond Green|דריימונד גרין|basketball|USA|4|2|4|2
Klay Thompson|קליי תומפסון|basketball|USA|5|2|5|1
Andre Iguodala|אנדרה איגודלה|basketball|USA|3|2|3|3
Kevin Garnett|קווין גארנט|basketball|USA|4|2|4|2
Allen Iverson|אלן איברסון|basketball|USA|5|2|5|1
Vince Carter|וינס קארטר|basketball|USA|4|2|4|2
Tracy McGrady|טרייסי מקגריידי|basketball|USA|4|2|4|2
Carmelo Anthony|כרמלו אנתוני|basketball|USA|4|2|4|2
Dwyane Wade|דוויין וייד|basketball|USA|5|2|5|1
Chris Bosh|כריס בוש|basketball|USA|3|2|3|3
Pau Gasol|פאו גאסול|basketball|Spain|4|2|4|2
Marc Gasol|מארק גאסול|basketball|Spain|3|2|3|3
Tony|טוני|basketball|France|2|1|2|5
Russell Westbrook|ראסל ווסטברוק|basketball|USA|5|2|5|1
James|ג'יימס|basketball|USA|2|1|2|5
Paul George|פול ג'ורג'|basketball|USA|4|2|4|2
Kyrie Irving|קיירי אירווינג|basketball|USA|5|2|5|1
Ben Simmons|בן סימונס|basketball|Australia|3|2|3|3
Patty Mills|פאטי מילס|basketball|Australia|3|2|3|3
LaMelo Ball|להמלו בול|basketball|USA|4|2|4|2
Lonzo Ball|לונזו בול|basketball|USA|3|2|3|3
Victor Wembanyama|ויקטור וומבניאמה|basketball|France|5|2|5|1
Chet Holmgren|צ'ט הולמגרן|basketball|USA|3|2|3|3
Paolo Banchero|פאולו באנצ'רו|basketball|USA|3|2|3|3
Scottie Barnes|סקוטי בארנס|basketball|Canada|3|2|3|3
Shai Gilgeous-Alexander|שאי גילג'ס אלכסנדר|basketball|Canada|5|2|5|1
Iga Swiatek|איגה שווייונטק|tennis|Poland|5|2|5|1
Coco Gauff|קוקו גאף|tennis|USA|5|2|5|1
Aryna Sabalenka|ארינה סבלנקה|tennis|Belarus|4|2|4|2
Ons Jabeur|אונס ג'אבור|tennis|Tunisia|3|2|3|3
Daniil Medvedev|דנייל מדדב|tennis|Russia|4|2|4|2
Alexander Zverev|אלכסנדר זברב|tennis|Germany|4|2|4|2
Stefanos Tsitsipas|סטפנוס ציציפאס|tennis|Greece|4|2|4|2
Casper Ruud|קספר רוד|tennis|Norway|3|2|3|3
Holger Rune|הולגר רונה|tennis|Denmark|3|2|3|3
Felix Auger-Aliassime|פיליקס אוז'ה אליאסים|tennis|Canada|3|2|3|3
Bianca Andreescu|ביאנקה אנדרסקו|tennis|Canada|3|2|3|3
Ashleigh Barty|אשלי בארטי|tennis|Australia|4|2|4|2
Naomi|נאומי|tennis|Japan|2|1|2|5
Emma Raducanu|אמה רדוקאנו|tennis|UK|4|2|4|2
Andy|אנדי|tennis|UK|2|1|2|5
Stan Wawrinka|סטן ואוורינקה|tennis|Switzerland|4|2|4|2
Marin Cilic|מארין ציליץ'|tennis|Croatia|3|2|3|3
Dominic Thiem|דומיניק תים|tennis|Austria|3|2|3|3
Juan Martin del Potro|חואן מרטין דל פוטרו|tennis|Argentina|4|2|4|2
Gustavo Kuerten|גוסטבו קוורטן|tennis|Brazil|3|2|3|3
Bjorn Borg|ביורן בורג|tennis|Sweden|4|2|4|2
John McEnroe|ג'ון מקנרו|tennis|USA|4|2|4|2
Boris Becker|בוריס בקר|tennis|Germany|4|2|4|2
Ivan Lendl|איוואן לנדל|tennis|Czechia|3|2|3|3
Chris Evert|כריס אוורט|tennis|USA|3|2|3|3
Billie Jean King|בילי ג'ין קינג|tennis|USA|4|2|4|2
Monica Seles|מוניקה סלס|tennis|USA|3|2|3|3
Justine Henin|ז'סטין הנין|tennis|Belgium|3|2|3|3
Kim Clijsters|קים קלייסטרס|tennis|Belgium|3|2|3|3
Venus|ווינוס|tennis|USA|2|1|2|5
`.trim();

const ROWS8 = `
// Politics / history / culture fill
Joe Rogan JR|ג'ו רוגן|media|USA|5|2|5|1
Lex Fridman|לקס פרידמן|media|USA|4|3|4|2
Andrew Tate|אנדרו טייט|media|UK|4|2|4|2
Elon Musk EM|אילון מאסק|technology|USA|5|3|5|1
Mark Zuckerberg MZ|מארק צוקרברג|technology|USA|5|3|5|1
Bill Gates BG|ביל גייטס|technology|USA|5|3|5|1
Steve Jobs SJ|סטיב ג'ובס|technology|USA|5|3|5|1
Tim Cook TC|טים קוק|technology|USA|4|2|4|2
Satya|סאטיה|technology|India|2|1|2|5
Sundar|סונדאר|technology|India|2|1|2|5
Warren|וורן|business|USA|2|1|2|5
Jamie Dimon|ג'יימי דיימון|business|USA|3|2|3|3
Ray Dalio|ריי דליו|business|USA|3|2|3|3
George Soros|ג'ורג' סורוס|business|Hungary|4|4|4|2
Sheldon Adelson|שלדון אדלסון|business|USA|3|5|3|3
Miriam Adelson|מרים אדלסון|business|USA|3|5|2|3
Idan Ofer|עידן עופר|business|Israel|3|5|2|3
Yossi Vardi|יוסי ורדי|technology|Israel|3|5|2|3
Dov Moran|דב מורן|technology|Israel|3|5|2|3
Gil Shwed|גיל שוויד|technology|Israel|4|5|2|2
Check Point Gil|גיל שוויד|technology|Israel|4|5|2|2
Shafi Goldwasser|שפי גולדווסר|science|Israel|3|5|3|3
Ada Yonath|עדה יונת|science|Israel|4|5|3|2
Dan Shechtman|דן שכטמן|science|Israel|4|5|3|2
Aaron Ciechanover|אהרון צ'חנובר|science|Israel|3|5|2|3
Avram Hershko|אברהם הרשקו|science|Israel|3|5|2|3
Robert Aumann|רוברט אומן|science|Israel|3|5|3|3
Daniel Kahneman|דניאל כהנמן|science|Israel|5|5|5|1
Amos Tversky|עמוס טברסקי|science|Israel|3|5|3|3
Yuval Noah Harari|יובל נח הררי|literature|Israel|5|5|5|1
David Grossman|דויד גרוסמן|literature|Israel|5|5|3|1
Amos Oz|עמוס עוז|literature|Israel|5|5|3|1
A B Yehoshua|א ב יהושע|literature|Israel|4|5|2|2
Meir Shalev|מאיר שלו|literature|Israel|5|5|2|1
Etgar Keret|אתגר קרת|literature|Israel|5|5|3|1
Zeruya Shalev|צרויה שלו|literature|Israel|3|5|1|3
Orly Castel-Bloom|אורלי קסטל בלום|literature|Israel|3|5|1|3
Sayed Kashua|סייד קשוע|literature|Israel|4|5|2|2
Naguib Mahfouz|נג'יב מחפוז|literature|Egypt|3|2|3|3
Orhan Pamuk|אורחן פאמוק|literature|Turkey|3|2|3|3
Kazuo Ishiguro|קאזואו אישיגורו|literature|UK|4|2|4|2
Margaret Atwood|מרגרט אטווד|literature|Canada|4|2|4|2
Toni Morrison|טוני מוריסון|literature|USA|4|2|4|2
Chimamanda Ngozi Adichie|צ'יממנדה נגוזי אדיצ'י|literature|Nigeria|3|2|3|3
Elena Ferrante|אלנה פרנטה|literature|Italy|3|2|3|3
Paulo Coelho|פאולו קואלו|literature|Brazil|5|2|5|1
Isabel Allende|איזבל איינדה|literature|Chile|3|2|3|3
Mario Vargas Llosa|מריו ורגס יוסה|literature|Peru|3|2|3|3
Gabriel|גבריאל|literature|Colombia|2|1|2|5
`.trim();

const ROWS9 = `
// Israeli entertainment / sports deep bench (high recognition locally)
Eyal Shani|אייל שני|food|Israel|5|5|2|1
Haim Cohen Chef|חיים כהן|food|Israel|5|5|1|1
Yisrael Aharoni Chef|ישראל אהרוני|food|Israel|5|5|1|1
Assaf Granit Chef|אסף גרניט|food|Israel|5|5|2|1
Meir Adoni|מאיר אדוני|food|Israel|4|5|1|2
Yonatan Roshfeld|יונתן רושפלד|food|Israel|4|5|1|2
Moshik Roth|מושיק רוט|food|Israel|4|5|2|2
Rafael Ani|רפאל אניי|food|Israel|2|4|1|4
Yotam Ottolenghi|יותם אוטולנגי|food|Israel|5|5|4|1
Michael Solomonov|מייקל סולומונוב|food|USA|3|4|3|3
Einat Admony|עינת אדמוני|food|USA|2|4|2|4
Alon Shaya|אלון שעיה|food|USA|2|4|2|4
Shahar Pe'er|שחר פאר|tennis|Israel|5|5|2|1
Dudi Sela|דודי סלע|tennis|Israel|4|5|1|2
Andy Ram|אנדי רם|tennis|Israel|4|5|1|2
Yoni Erlich|יוני ארליך|tennis|Israel|4|5|1|2
Anna Smashnova|אנה סמשנובה|tennis|Israel|3|5|1|3
Amos Mansdorf|עמוס מנסדורף|tennis|Israel|3|5|1|3
Jonathan Erlich|יונתן ארליך|tennis|Israel|4|5|1|2
Gal Fridman Sail|גל פרידמן|olympics|Israel|5|5|2|1
Yael Arad Judo|יעל ארד|olympics|Israel|5|5|2|1
Linoy Ashram Gym|לינוי אשרם|olympics|Israel|5|5|3|1
Artem Dolgopyat|ארטיום דולגופיאט|olympics|Israel|5|5|3|1
Inbar Lanir|ענבר לניר|olympics|Israel|4|5|2|2
Peter Paltchik|פטר פלצ'יק|olympics|Israel|4|5|2|2
Sagi Muki|שגיא מוקי|olympics|Israel|4|5|2|2
Ori Sasson|אורי ששון|olympics|Israel|4|5|1|2
Arik Ze'evi|אריק זאבי|olympics|Israel|4|5|1|2
Windsurfer Shahar|שחר צוברי|olympics|Israel|4|5|1|2
Maor Tiyouri|מאור טיורי|athletics|Israel|2|5|1|4
Lonah Chemtai Salpeter|לונה צ'מטאי סלפטר|athletics|Israel|4|5|2|2
Maraton Maru|מרו טפרי|athletics|Israel|3|5|1|3
Beatie Deutsch|ביטי דויטש|athletics|Israel|3|5|1|3
Omri Casspi|עמרי כספי|basketball|Israel|5|5|3|1
Gal Mekel|גל מקל|basketball|Israel|4|5|2|2
Deni Avdija|דני אבדיה|basketball|Israel|5|5|4|1
Yam Madar|ים מדר|basketball|Israel|4|5|2|2
Tomer Ginat|תומר גינת|basketball|Israel|3|5|1|3
Yotam Halperin|יותם הלפרין|basketball|Israel|4|5|1|2
Lior Eliyahu|ליאור אליהו|basketball|Israel|4|5|1|2
Guy Pnini|גיא פניני|basketball|Israel|4|5|1|2
Moran Roth|מורן רוט|basketball|Israel|3|5|1|3
Afik Nissim|אפיק ניסים|basketball|Israel|3|5|1|3
Doron Sheffer|דורון שפר|basketball|Israel|4|5|1|2
Nadav Henefeld|נדב הנפלד|basketball|Israel|3|5|1|3
Miki Berkovich|מיקי ברקוביץ'|basketball|Israel|5|5|2|1
Tal Brody|טל ברודי|basketball|Israel|5|5|2|1
Aulcie Perry|אולסי פרי|basketball|USA|3|5|1|3
Anthony Parker IL|אנתוני פארקר|basketball|USA|3|4|2|3
`.trim();

const ROWS10 = `
// Music / TV / actors fill to push past 1000 unique
Billie|בילי|music|USA|3|2|3|3
Olivia|אוליביה|music|USA|2|1|2|5
Sabrina|סברינה|music|USA|2|1|2|5
Harry|הארי|music|UK|2|1|2|5
Zayn Malik|זיין מאליק|music|UK|5|2|5|1
Liam Payne|ליאם פיין|music|UK|4|2|4|2
Niall Horan|ניאל הורן|music|Ireland|4|2|4|2
Louis Tomlinson|לואי טומלינסון|music|UK|4|2|4|2
One Direction Harry|הארי סטיילס|music|UK|5|2|5|1
Simon Cowell|סיימון קאוול|television|UK|5|2|5|1
Howie Mandel|האווי מנדל|television|Canada|4|3|4|2
Heidi|היידי|television|Germany|2|1|2|5
Sofia Vergara|סופיה ורגרה|actors|Colombia|5|2|5|1
Modern Family Phil|פיל דאנפי|actors|USA|3|2|3|3
Ty Burrell|טיי בארל|actors|USA|3|2|3|3
Julie Bowen|ג'ולי בוון|actors|USA|3|2|3|3
Jesse Tyler Ferguson|ג'סי טיילר פרגוסון|actors|USA|3|2|3|3
Eric Stonestreet|אריק סטונסטריט|actors|USA|3|2|3|3
Sarah Hyland|שרה הילנד|actors|USA|3|2|3|3
Ariel Winter|אריאל וינטר|actors|USA|3|2|3|3
Nolan Gould|נולן גולד|actors|USA|2|2|2|4
Rico Rodriguez|ריקו רודריגז|actors|USA|2|2|2|4
Ed ONeill|אד אוניל|actors|USA|4|2|4|2
Katey Sagal|קייטי סאגאל|actors|USA|3|2|3|3
Sofia|סופיה|actors|Colombia|2|1|2|5
Bryan Cranston Walter|בראיין קרנסטון|actors|USA|5|2|5|1
Bob Newhart|בוב ניוהארט|comedy|USA|2|2|2|4
Carol Burnett|קרול ברנט|comedy|USA|3|2|3|3
Lucille Ball|לוסיל בול|comedy|USA|4|2|4|2
Mary Tyler Moore|מרי טיילר מור|comedy|USA|3|2|3|3
Dick Van Dyke|דיק ואן דייק|comedy|USA|3|2|3|3
Johnny Carson|ג'וני קרסון|media|USA|4|2|4|2
Joan Rivers|ג'ואן ריברס|comedy|USA|4|3|4|2
Don Rickles|דון ריקלס|comedy|USA|3|3|3|3
Rodney Dangerfield|רודני דיינג'רפילד|comedy|USA|3|3|3|3
Mel Brooks|מל ברוקס|comedy|USA|5|4|5|1
Carl Reiner|קארל ריינר|comedy|USA|3|3|3|3
Gene Wilder|ג'ין ויילדר|comedy|USA|4|3|4|2
Richard Pryor|ריצ'רד פרייר|comedy|USA|4|2|4|2
Eddie|אדי|comedy|USA|2|1|2|5
Chris Farley|כריס פארלי|comedy|USA|4|2|4|2
Phil Hartman|פיל הרטמן|comedy|USA|3|2|3|3
Will Ferrell WF|ויל פרל|comedy|USA|4|2|4|2
Kristen|קריסטן|comedy|USA|2|1|2|5
Maya Rudolph|מאיה רודולף|comedy|USA|4|2|4|2
Kenan Thompson|קינן תומפסון|comedy|USA|3|2|3|3
Leslie Jones|לסלי ג'ונס|comedy|USA|3|2|3|3
Pete Davidson|פיט דייווידסון|comedy|USA|4|2|4|2
Colin Jost|קולין ג'וסט|comedy|USA|3|2|3|3
Michael Che|מייקל צ'ה|comedy|USA|3|2|3|3
Cecily Strong|ססילי סטרונג|comedy|USA|2|2|2|4
Aidy Bryant|איידי בראיינט|comedy|USA|2|2|2|4
Kate|קייט|comedy|USA|2|1|2|5
`.trim();

const ROWS11 = `
// Final push — solid recognizable faces only (no weak single names)
Tom Brady|טום בריידי|athletics|USA|5|2|5|1
Patrick Mahomes|פטריק מהומס|athletics|USA|5|2|5|1
Aaron Rodgers|אהרון רוג'רס|athletics|USA|4|2|4|2
Peyton Manning|פייטון מאנינג|athletics|USA|4|2|4|2
Joe Montana|ג'ו מונטנה|athletics|USA|4|2|4|2
Jerry Rice|ג'רי רייס|athletics|USA|3|2|3|3
Odell Beckham Jr|אודל בקהאם ג'וניור|athletics|USA|4|2|4|2
Travis Kelce|טראוויס קלסי|athletics|USA|5|2|5|1
Rob Gronkowski|רוב גרונקובסקי|athletics|USA|4|2|4|2
Tom Brady TB|טום בריידי|athletics|USA|5|2|5|1
Lionel Messi LM|ליונל מסי|football|Argentina|5|3|5|1
Cristiano Ronaldo CR|כריסטיאנו רונאלדו|football|Portugal|5|3|5|1
Neymar Jr|ניימאר|football|Brazil|5|2|5|1
Kylian Mbappe KM|קיליאן אמבפה|football|France|5|2|5|1
Erling Haaland EH|ארלינג הולאנד|football|Norway|5|2|5|1
Wayne Gretzky|ויין גרצקי|athletics|Canada|5|2|5|1
Sidney Crosby|סידני קרוסבי|athletics|Canada|4|2|4|2
Alexander Ovechkin|אלכסנדר אובצ'קין|athletics|Russia|4|2|4|2
Connor McDavid|קונור מקדייוויד|athletics|Canada|4|2|4|2
Mario Lemieux|מריו למיה|athletics|Canada|3|2|3|3
Babe Ruth|בייב רות'|athletics|USA|4|2|4|2
Derek Jeter|דרק ג'יטר|athletics|USA|4|2|4|2
Shohei Ohtani|שוהיי אוטאני|athletics|Japan|5|2|5|1
Mike Trout|מייק טראוט|athletics|USA|3|2|3|3
Aaron Judge|אהרון ג'אדג'|athletics|USA|4|2|4|2
Mookie Betts|מוקי בטס|athletics|USA|3|2|3|3
David Ortiz|דייוויד אורטיז|athletics|USA|4|2|4|2
Barry Bonds|בארי בונדס|athletics|USA|3|2|3|3
Ken Griffey Jr|קן גריפי ג'וניור|athletics|USA|3|2|3|3
Ichiro Suzuki|איצ'ירו סוזוקי|athletics|Japan|4|2|4|2
Serena|סרינה|tennis|USA|3|2|3|3
Roger|רוג'ר|tennis|Switzerland|2|1|2|5
Rafa|רפא|tennis|Spain|3|2|3|3
Novak|נובאק|tennis|Serbia|3|2|3|3
Lewis|לואיס|formula1|UK|2|1|2|5
Max|מקס|formula1|Netherlands|2|1|2|5
Sebastian|סבסטיאן|formula1|Germany|2|1|2|5
Ayrton|איירטון|formula1|Brazil|2|1|2|5
Usain|יוסיין|athletics|Jamaica|3|2|3|3
Michael Phelps MP|מייקל פלפס|swimming|USA|5|2|5|1
Simone|סימון|olympics|USA|2|1|2|5
Katie|קייטי|swimming|USA|2|1|2|5
Conor|קונור|mma|Ireland|2|1|2|5
Mike Tyson MT|מייק טייסון|boxing|USA|5|2|5|1
Muhammad Ali MA|מוחמד עלי|boxing|USA|5|2|5|1
Floyd|פלויד|boxing|USA|2|1|2|5
Manny|מני|boxing|Philippines|2|1|2|5
Canelo Alvarez|קאנלו אלברס|boxing|Mexico|4|2|4|2
Tyson Fury|טייסון פיורי|boxing|UK|4|2|4|2
Anthony Joshua|אנתוני ג'ושואה|boxing|UK|4|2|4|2
Oleksandr Usyk|אולכסנדר אוסיק|boxing|Ukraine|4|2|4|2
Vasiliy Lomachenko|וסילי לומצ'נקו|boxing|Ukraine|3|2|3|3
Gennady Golovkin|גנאדי גולובקין|boxing|Kazakhstan|3|2|3|3
Roy Jones Jr|רוי ג'ונס ג'וניור|boxing|USA|3|2|3|3
Evander Holyfield|אוונדר הוליפילד|boxing|USA|4|2|4|2
George Foreman|ג'ורג' פורמן|boxing|USA|4|2|4|2
Joe Louis|ג'ו לואיס|boxing|USA|3|2|3|3
Sugar Ray Leonard|שוגר ריי לאונרד|boxing|USA|3|2|3|3
Rocky Marciano|רוקי מרצ'יאנו|boxing|USA|3|2|3|3
Jack Dempsey|ג'ק דמפסי|boxing|USA|2|2|2|4
`.trim();

const ROWS12 = `
// Israeli music / politics / culture not covered by v1 people list
Omer Adam OA|עומר אדם|music|Israel|5|5|3|1
Noa Kirel NK|נועה קירל|music|Israel|5|5|3|1
Eyal Golan EG|אייל גולן|music|Israel|5|5|2|1
Static ST|סטטיק|music|Israel|5|5|2|1
Ben El Tavori BE|בן אל תבורי|music|Israel|5|5|2|1
Eden Hason EH2|עדן חסון|music|Israel|5|5|2|1
Eden Ben Zaken EBZ|עדן בן זקן|music|Israel|5|5|2|1
Netta Barzilai NB|נטע ברזילי|music|Israel|5|5|4|1
Rita Singer|ריטה|music|Israel|5|5|2|1
Sarit Hadad SH|שרית חדד|music|Israel|5|5|2|1
Keren Peles KP|קרן פלס|music|Israel|5|5|2|1
Ivri Lider IL|עברי לידר|music|Israel|5|5|2|1
Rami Kleinstein RK|רמי קלינשטיין|music|Israel|5|5|2|1
Shlomo Artzi SA|שלמה ארצי|music|Israel|5|5|2|1
Yehoram Gaon YG|יהורם גאון|music|Israel|5|5|2|1
Ofra Haza OH|עפרה חזה|music|Israel|5|5|3|1
Arik Einstein AE|אריק איינשטיין|music|Israel|5|5|2|1
Shalom Hanoch SH2|שלום חנוך|music|Israel|5|5|2|1
Berry Sakharof BS|ברי סחרוף|music|Israel|5|5|2|1
Dudu Tasa DT|דודו טסה|music|Israel|5|5|2|1
Moshe Peretz MP2|משה פרץ|music|Israel|5|5|2|1
Itay Levi IL2|איתי לוי|music|Israel|5|5|2|1
Ishay Ribo IR|ישי ריבו|music|Israel|5|5|2|1
Hanan Ben Ari HBA|חנן בן ארי|music|Israel|5|5|2|1
Nasrin Kadri NK2|נסרין קדרי|music|Israel|5|5|2|1
Mergui MG|מרגי|music|Israel|5|5|2|1
Anna Zak AZ|אנה זק|music|Israel|5|5|2|1
Shiri Maimon SM|שירי מימון|music|Israel|5|5|2|1
Miri Mesika MM|מירי מסיקה|music|Israel|5|5|2|1
Harel Skaat HS|הראל סקעת|music|Israel|5|5|2|1
Muki Singer|מוקי|music|Israel|4|5|1|2
Dikla Singer|דיקלה|music|Israel|4|5|1|2
Rami Fortis RF|רמי פורטיס|music|Israel|5|5|2|1
Ehud Banai EB|אהוד בנאי|music|Israel|5|5|1|1
Meir Banai MB|מאיר בנאי|music|Israel|4|5|1|2
Yehudit Ravitz YR|יהודית רביץ|music|Israel|5|5|1|1
Nurit Galron NG|נורית גלרון|music|Israel|4|5|1|2
Gidi Gov GG|גידי גוב|music|Israel|5|5|1|1
Yizhar Ashdot YA|יזהר אשדות|music|Israel|4|5|1|2
Corinne Allal CA|קורין אלאל|music|Israel|4|5|1|2
Si Heiman SI|סי היימן|music|Israel|4|5|1|2
Rona Kenan RK2|רונה קינן|music|Israel|4|5|1|2
Asaf Avidan AA|אסף אבידן|music|Israel|5|5|3|1
Infected Mushroom IM|אינפקטד משרום|music|Israel|4|5|3|2
Astral Projection AP|אסטרל פרוג'קשן|music|Israel|3|5|2|3
Offer Nissim ON|עופר ניסים|music|Israel|4|5|2|2
Ivri|עברי|music|Israel|2|5|1|4
`.trim();

const ROWS13 = `
// More world-famous remaining faces
Pope John Paul II|האפיפיור יוחנן פאולוס השני|religion|Poland|5|3|5|1
Pope Benedict XVI|האפיפיור בנדיקטוס השישה עשר|religion|Germany|4|2|4|2
Billy Graham|בילי גרהאם|religion|USA|3|2|3|3
Desmond Tutu|דזמונד טוטו|religion|South Africa|4|2|4|2
Dalai|דלאי|religion|Tibet|2|1|2|5
Rabbi Ovadia Yosef|הרב עובדיה יוסף|religion|Israel|5|5|2|1
Rabbi Yitzhak Yosef|הרב יצחק יוסף|religion|Israel|4|5|1|2
Rabbi Shlomo Amar|הרב שלמה עמאר|religion|Israel|3|5|1|3
Rabbi Chaim Kanievsky|הרב חיים קנייבסקי|religion|Israel|5|5|2|1
Rabbi Aharon Leib Shteinman|הרב אהרן לייב שטיינמן|religion|Israel|4|5|1|2
Rabbi Jonathan Sacks|הרב יונתן זקס|religion|UK|4|4|3|2
Rabbi Meir Kahane|מאיר כהנא|politics|Israel|4|5|2|2
Menachem Begin|מנחם בגין|politics|Israel|5|5|3|1
Yitzhak Shamir YS|יצחק שמיר|politics|Israel|5|5|2|1
Levi Eshkol|לוי אשכול|politics|Israel|4|5|1|2
Moshe Sharett|משה שרת|politics|Israel|3|5|1|3
Ehud Olmert|אהוד אולמרט|politics|Israel|5|5|2|1
Ariel Sharon AS|אריאל שרון|politics|Israel|5|5|3|1
Ehud Barak EB2|אהוד ברק|politics|Israel|5|5|3|1
Yair Lapid YL|יאיר לפיד|politics|Israel|5|5|3|1
Naftali Bennett NB2|נפתלי בנט|politics|Israel|5|5|3|1
Benny Gantz|בני גנץ|politics|Israel|5|5|2|1
Avigdor Lieberman|אביגדור ליברמן|politics|Israel|5|5|2|1
Itamar Ben Gvir|איתמר בן גביר|politics|Israel|5|5|2|1
Bezalel Smotrich|בצלאל סמוטריץ'|politics|Israel|5|5|2|1
Yair Golan|יאיר גולן|politics|Israel|4|5|1|2
Merav Michaeli|מרב מיכאלי|politics|Israel|4|5|1|2
Tzipi Livni|ציפי לבני|politics|Israel|5|5|2|1
Shelly Yachimovich|שלי יחימוביץ'|politics|Israel|4|5|1|2
Zehava Galon|זהבה גלאון|politics|Israel|3|5|1|3
Ayman Odeh|איימן עודה|politics|Israel|4|5|1|2
Mansour Abbas|מנצור עבאס|politics|Israel|4|5|1|2
Ahmed Tibi|אחמד טיבי|politics|Israel|5|5|1|1
Reuven Rivlin|ראובן ריבלין|politics|Israel|5|5|2|1
Isaac Herzog|יצחק הרצוג|politics|Israel|5|5|3|1
Chaim Herzog|חיים הרצוג|politics|Israel|4|5|2|2
Zalman Shazar|זלמן שזר|politics|Israel|3|5|1|3
Ephraim Katzir|אפרים קציר|politics|Israel|3|5|1|3
Yitzhak Navon|יצחק נבון|politics|Israel|4|5|1|2
Moshe Katsav|משה קצב|politics|Israel|4|5|1|2
Shimon Peres SP|שמעון פרס|politics|Israel|5|5|4|1
Ezer Weizman|עזר ויצמן|politics|Israel|4|5|1|2
Chaim Weizmann CW|חיים ויצמן|politics|Israel|5|5|3|1
Theodor Herzl|בנימין זאב הרצל|history|Austria|5|5|4|1
Ze'ev Jabotinsky|זאב ז'בוטינסקי|history|Israel|5|5|2|1
Hannah Senesh|חנה סנש|history|Hungary|5|5|2|1
Anne Frank AF|אנה פרנק|literature|Netherlands|5|4|5|1
Hannah Arendt|חנה ארנדט|literature|Germany|3|4|3|3
Primo Levi|פרימו לוי|literature|Italy|4|4|3|2
Elie Wiesel|אלי ויזל|literature|Romania|5|5|4|1
Simon Wiesenthal|סימון ויזנטל|history|Austria|4|4|3|2
Raoul Wallenberg|ראול ולנברג|history|Sweden|4|4|3|2
Oskar Schindler|אוסקר שינדלר|history|Germany|5|4|5|1
Irena Sendler|אירנה סנדלר|history|Poland|3|3|3|3
`.trim();

const ROWS14 = `
// Final quality batch — globally iconic remaining
Greta Thunberg GT|גרטה תונברג|activism|Sweden|5|2|5|1
Malala|מלאלה|activism|Pakistan|4|2|4|2
Alexandria|אלכסנדריה|politics|USA|2|1|2|5
Bernie|ברני|politics|USA|3|2|3|3
AOC|אייאוסי|politics|USA|3|2|3|3
Nancy Pelosi|ננסי פלוסי|politics|USA|4|2|4|2
Mitch McConnell|מיץ' מקונל|politics|USA|3|2|3|3
Chuck Schumer|צ'אק שומר|politics|USA|4|3|4|2
Ted Cruz|טד קרוז|politics|USA|3|2|3|3
Marco Rubio|מארקו רוביו|politics|USA|3|2|3|3
Nikki Haley|ניקי היילי|politics|USA|3|2|3|3
Ron DeSantis|רון דה סנטיס|politics|USA|3|2|3|3
Gavin Newsom|גאווין ניוסם|politics|USA|3|2|3|3
Alexandria Ocasio|אלכסנדריה אוקסיו קורטז|politics|USA|3|2|3|3
Pete Buttigieg|פיט בוטיג'ג'|politics|USA|3|2|3|3
Elizabeth Warren|אליזבת וורן|politics|USA|3|2|3|3
Amy Klobuchar|איימי קלובשר|politics|USA|2|2|2|4
Tulsi Gabbard|טולסי גבארד|politics|USA|2|2|2|4
Andrew Yang|אנדרו יאנג|politics|USA|3|2|3|3
RFK Jr|רוברט קנדי ג'וניור|politics|USA|4|2|4|2
Jared Kushner|ג'ארד קושנר|politics|USA|4|4|4|2
Ivanka Trump|איוונקה טראמפ|politics|USA|5|2|5|1
Melania Trump|מלאניה טראמפ|politics|USA|5|2|5|1
Donald Trump Jr|דונלד טראמפ ג'וניור|politics|USA|4|2|4|2
Eric Trump|אריק טראמפ|politics|USA|3|2|3|3
Hunter Biden|האנטר ביידן|politics|USA|4|2|4|2
Jill Biden|ג'יל ביידן|politics|USA|4|2|4|2
Chelsea Clinton|צ'לסי קלינטון|politics|USA|3|2|3|3
Malia Obama|מליה אובמה|politics|USA|3|2|3|3
Sasha Obama|סשה אובמה|politics|USA|3|2|3|3
Boris Johnson|בוריס ג'ונסון|politics|UK|5|2|5|1
Rishi Sunak|רישי סונאק|politics|UK|5|2|5|1
Keir Starmer|קיר סטארמר|politics|UK|4|2|4|2
Tony Blair|טוני בלייר|politics|UK|5|2|5|1
Gordon Brown|גורדון בראון|politics|UK|3|2|3|3
David Cameron|דייוויד קמרון|politics|UK|4|2|4|2
Theresa May|תרזה מיי|politics|UK|4|2|4|2
Liz Truss|ליז טראס|politics|UK|4|2|4|2
Nigel Farage|נייג'ל פאראג'|politics|UK|4|2|4|2
Jeremy Corbyn|ג'רמי קורבין|politics|UK|4|2|4|2
Sadiq Khan|סאדיק חאן|politics|UK|3|2|3|3
Nicola Sturgeon|ניקולה סטרג'ן|politics|UK|3|2|3|3
Alex Salmond|אלכס סלמונד|politics|UK|2|2|2|4
Olaf Scholz|אולף שולץ|politics|Germany|4|2|4|2
Friedrich Merz|פרידריך מרץ|politics|Germany|2|2|2|4
Giorgia Meloni|ג'ורג'ה מלוני|politics|Italy|5|2|5|1
Silvio Berlusconi|סילביו ברלוסקוני|politics|Italy|5|2|5|1
Matteo Salvini|מאתאו סלביני|politics|Italy|3|2|3|3
Pedro Sanchez|פדרו סאנצ'ס|politics|Spain|4|2|4|2
Mariano Rajoy|מריאנו ראחוי|politics|Spain|2|2|2|4
Recep Tayyip Erdogan|רג'פ טאיפ ארדואן|politics|Turkey|5|3|5|1
Benjamin Netanyahu BN|בנימין נתניהו|politics|Israel|5|5|5|1
Yitzhak Rabin YR2|יצחק רבין|politics|Israel|5|5|5|1
David Ben-Gurion DBG|דוד בן גוריון|politics|Israel|5|5|5|1
Golda Meir GM|גולדה מאיר|politics|Israel|5|5|5|1
`.trim();

const allRaw = [
  ...parseBlock(ROWS),
  ...parseBlock(ROWS2),
  ...parseBlock(ROWS3),
  ...parseBlock(ROWS4),
  ...parseBlock(ROWS5),
  ...parseBlock(ROWS6),
  ...parseBlock(ROWS7),
  ...parseBlock(ROWS8),
  ...parseBlock(ROWS9),
  ...parseBlock(ROWS10),
  ...parseBlock(ROWS11),
  ...parseBlock(ROWS12),
  ...parseBlock(ROWS13),
  ...parseBlock(ROWS14),
  ...EXTRA,
];

function letterLen(he) {
  return Array.from(he.replace(/\s+/g, "")).length;
}

const seenSubject = new Set();
const seenAnswer = new Set();
const people = [];
const rejected = { v1Subject: 0, v1Answer: 0, dupSubject: 0, dupAnswer: 0, weak: 0 };

for (const p of allRaw) {
  const ns = normSubject(p.subject);
  const na = p.answer_hebrew.replace(/\s+/g, "");
  // Drop weak single-token English placeholders / too-short answers
  if (
    p.subject.split(/\s+/).length === 1 &&
    letterLen(p.answer_hebrew) <= 4 &&
    p.recognition < 5
  ) {
    rejected.weak += 1;
    continue;
  }
  if (excludeSubject.has(ns) || [...excludeSubject].some((s) => s === ns)) {
    rejected.v1Subject += 1;
    continue;
  }
  // Also fuzzy: if subject core matches v1 after removing stage suffixes
  const core = ns.replace(/\b(jr|sr|ii|iii|oa|nk|eg|st|be|eh2|ebz|nb|sh|kp|il|rk|sa|yg|oh|ae|sh2|bs|dt|mp2|il2|ir|hba|nk2|mg|az|sm|mm|hs|rf|eb|mb|yr|ng|gg|ya|ca|si|rk2|aa|im|ap|on|cr7|goat|lm|cr|km|eh|mt|ma|sj|bg|mz|em|jr|tb|mp|gt|bn|yr2|dbg|gm|sp|cw|as|eb2|yl|nb2)\b/g, "").replace(/\s+/g, " ").trim();
  if (excludeSubject.has(core)) {
    rejected.v1Subject += 1;
    continue;
  }
  if (excludeAnswer.has(na)) {
    rejected.v1Answer += 1;
    continue;
  }
  if (seenSubject.has(ns) || seenSubject.has(core)) {
    rejected.dupSubject += 1;
    continue;
  }
  if (seenAnswer.has(na)) {
    rejected.dupAnswer += 1;
    continue;
  }
  seenSubject.add(ns);
  if (core) seenSubject.add(core);
  seenAnswer.add(na);
  people.push(p);
}

console.log("parsed", allRaw.length, "unique kept", people.length, "rejected", rejected);

if (people.length < 1000) {
  console.error(`Need 1000 unique people, only have ${people.length}. Add more rows.`);
  process.exit(1);
}

// Prefer higher recognition, then israeli/global relevance; take top 1000
people.sort((a, b) => {
  const score = (p) =>
    p.recognition * 100 + p.global_relevance * 10 + p.israeli_relevance * 5 - p.difficulty;
  return score(b) - score(a);
});

const selected = people.slice(0, 1000);

const out = selected.map((p, i) => ({
  id: `img_${String(501 + i).padStart(4, "0")}`,
  type: "person",
  category: p.category,
  subject: p.subject.replace(/\s+(OA|NK|EG|ST|BE|EH2|EBZ|NB|SH|KP|IL|RK|SA|YG|OH|AE|SH2|BS|DT|MP2|IL2|IR|HBA|NK2|MG|AZ|SM|MM|HS|RF|EB|MB|YR|NG|GG|YA|CA|SI|RK2|AA|IM|AP|ON|CR7|GOAT|LM|CR|KM|EH|MT|MA|SJ|BG|MZ|EM|JR|TB|MP|GT|BN|YR2|DBG|GM|SP|CW|AS|EB2|YL|NB2|Wonder|Chef|Sail|Judo|Gym|IL|Paul|Walter|Jesse|Better|Abel|Robert|Wanda)$/i, "").replace(/\s+/g, " ").trim()
    // cleaner subject cleanup for known suffix tags
    .replace(/\s+(CR7|GOAT|Jr|SJ|BG|MZ|EM|TC|LM|CR|KM|EH|MT|MA|TB|MP|GT|BN|DBG|GM|SP|CW|AS|EB2|YL|NB2|OA|NK|EG|ST|BE|EH2|EBZ|NB|SH|KP|IL2|IR|HBA|NK2|MG|AZ|SM|MM|HS|RF|EB|MB|YR|NG|GG|YA|CA|SI|RK2|AA|IM|AP|ON|JR2|WF|JG|YS)$/i, "")
    .trim(),
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
}));

// Final subject cleanup pass — remove generation tags more carefully
for (const row of out) {
  row.subject = row.subject
    .replace(/\b(CR7|GOAT|EH2|EBZ|MP2|IL2|SH2|HBA|NK2|RK2|EB2|YL|NB2|YR2|DBG|JR2)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Re-check unique subjects after cleanup
const finalSubjects = new Set();
const finalAnswers = new Set();
const cleaned = [];
for (const row of out) {
  const ns = normSubject(row.subject);
  const na = row.answer_hebrew.replace(/\s+/g, "");
  if (excludeSubject.has(ns) || excludeAnswer.has(na)) continue;
  if (finalSubjects.has(ns) || finalAnswers.has(na)) continue;
  if (!row.subject || !row.answer_hebrew) continue;
  finalSubjects.add(ns);
  finalAnswers.add(na);
  cleaned.push(row);
}

if (cleaned.length < 1000) {
  // fill from remaining people pool
  for (const p of people.slice(1000)) {
    if (cleaned.length >= 1000) break;
    const subject = p.subject
      .replace(/\b(CR7|GOAT|EH2|EBZ|MP2|IL2|SH2|HBA|NK2|RK2|EB2|YL|NB2|YR2|DBG|JR2|OA|NK|EG|ST|BE|NB|SH|KP|IR|MG|AZ|SM|MM|HS|RF|EB|MB|YR|NG|GG|YA|CA|SI|AA|IM|AP|ON|SJ|BG|MZ|EM|TC|LM|CR|KM|EH|MT|MA|TB|MP|GT|BN|GM|SP|CW|AS|WF|JG|YS|Wonder|Chef|Sail|Judo|Gym|Paul|Walter|Jesse|Better|Abel|Robert|Wanda)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const ns = normSubject(subject);
    const na = p.answer_hebrew.replace(/\s+/g, "");
    if (!subject || excludeSubject.has(ns) || excludeAnswer.has(na)) continue;
    if (finalSubjects.has(ns) || finalAnswers.has(na)) continue;
    finalSubjects.add(ns);
    finalAnswers.add(na);
    cleaned.push({
      id: `img_temp`,
      type: "person",
      category: p.category,
      subject,
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
    });
  }
}

const finalList = cleaned.slice(0, 1000).map((row, i) => ({
  ...row,
  id: `img_${String(501 + i).padStart(4, "0")}`,
}));

if (finalList.length !== 1000) {
  console.error(`Final count ${finalList.length}, expected 1000`);
  process.exit(1);
}

const outPath = path.join(dataDir, "arrow_image_clues_1000_v2.json");
fs.writeFileSync(outPath, JSON.stringify(finalList, null, 2) + "\n");

const lens = finalList.map((x) => letterLen(x.answer_hebrew));
const cats = {};
for (const x of finalList) cats[x.category] = (cats[x.category] || 0) + 1;
console.log("Wrote", outPath);
console.log("categories", cats);
console.log("letterLength min/avg/max", Math.min(...lens), (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1), Math.max(...lens));
console.log("sample", finalList.slice(0, 5).map((x) => `${x.id} ${x.subject} → ${x.answer_hebrew}`));
console.log("tail", finalList.slice(-3).map((x) => `${x.id} ${x.subject} → ${x.answer_hebrew}`));

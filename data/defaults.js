const STORAGE_KEY="bijvoedingVoorraad_2_5_2";
const makeProduct=(mode,name,flavor,consumptionUnit,orderUnit,content,order)=>({
  id:crypto.randomUUID(),mode,name,flavor,consumptionUnit,orderUnit,
  contentPerOrderUnit:content,stockFull:0,stockLoose:0,alreadyOrdered:0,generalTarget:0,
  minimumStock:0,order
});
const defaults={
  settings:{drinkWeeks:3,sondeWeeks:3},
  products:[
    makeProduct("drink","Glucerna","Aardbei","flesjes","flesje",1,1),
    makeProduct("drink","Glucerna","Niet gespecificeerd","flesjes","flesje",1,2),
    makeProduct("drink","Ensure Two Cal","Niet gespecificeerd","flesjes","flesje",1,3),
    makeProduct("drink","Ensure Plus Advance","Niet gespecificeerd","flesjes","flesje",1,4),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Mokka","bakjes","bakje",1,5),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Chocolade","bakjes","bakje",1,6),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Niet gespecificeerd","bakjes","bakje",1,7),
    makeProduct("drink","Bouwsteentje","Niet gespecificeerd","bakjes","bakje",1,8),
    makeProduct("drink","Drinkyoghurt","Niet gespecificeerd","flesjes","flesje",1,9),
    makeProduct("drink","Vruchtenkwark of vla","Niet gespecificeerd","bakjes","bakje",1,10),
    makeProduct("drink","Abound","Neutraal","zakjes","doos",30,11),
    makeProduct("drink","Abound","Sinaasappel","zakjes","doos",30,12),
    makeProduct("sonde","Jevity 1.5","","ml","fles",1000,1)
  ],
  rooms:[]
};

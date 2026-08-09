const STORAGE_KEY="bijvoedingVoorraad_2_5_2";
const makeProduct=(mode,name,flavor,consumptionUnit,orderUnit,content,order)=>({
  id:crypto.randomUUID(),mode,name,flavor,consumptionUnit,orderUnit,
  contentPerOrderUnit:content,looseUnitsAllowed:content>1,stockFull:0,stockLoose:0,alreadyOrdered:0,generalTarget:0,
  minimumStock:0,order,expiryDate:"",lastExpiryCheck:"",active:true
});
const defaults={
  settings:{drinkWeeks:3,sondeWeeks:3,cupboardOrderApplied:true},
  products:[
    makeProduct("drink","Abound","Neutraal","zakjes","doos",30,1),
    makeProduct("drink","Abound","Sinaasappel","zakjes","doos",30,2),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Banaan","bakjes","bakje",1,3),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Bosvruchten","bakjes","bakje",1,4),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Chocolade","bakjes","bakje",1,5),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Mokka","bakjes","bakje",1,6),
    makeProduct("drink","Nutridrink Crème 2 kcal Protein","Vanille","bakjes","bakje",1,7),
    makeProduct("drink","Ensure Two Cal","Aardbei","flesjes","flesje",1,8),
    makeProduct("drink","Ensure Two Cal","Banaan","flesjes","flesje",1,9),
    makeProduct("drink","Ensure Two Cal","Vanille","flesjes","flesje",1,10),
    makeProduct("drink","Glucerna Advance","Aardbei","flesjes","flesje",1,11),
    makeProduct("drink","Glucerna Advance","Koffie","flesjes","flesje",1,12),
    makeProduct("drink","Ensure Plus Advance","Aardbei","flesjes","flesje",1,13),
    makeProduct("drink","Ensure Plus Advance","Banaan","flesjes","flesje",1,14),
    makeProduct("drink","Ensure Plus Advance","Chocolade","flesjes","flesje",1,15),
    makeProduct("drink","Ensure Plus Advance","Koffie","flesjes","flesje",1,16),
    makeProduct("drink","Ensure Plus Advance","Vanille","flesjes","flesje",1,17),
    makeProduct("drink","Glucerna Advance","Vanille","flesjes","flesje",1,18),
    makeProduct("sonde","Jevity 1.5","","ml","fles",1000,1)
  ],
  rooms:[]
};

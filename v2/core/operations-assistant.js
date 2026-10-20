import {dashboardReport} from "./operations-report.js";
export function answerQuestion(orders,question){
 if(!Array.isArray(orders)||typeof question!=="string")throw Error("Invalid input");
 const q=question.trim().toLowerCase();
 const stats=dashboardReport(orders).stats;
 const answer=(message)=>({answer:message,readOnly:true,source:"authorized_orders",mode:"deterministic"});
 if(/(مرتجع|return|استثناء)/.test(q))return answer("عدد حالات الاستثناء: "+stats.exception);
 if(/(تسليم|delivered|مسلم)/.test(q))return answer("عدد الشحنات المسلمة: "+stats.delivered);
 if(/(مندوب|unassigned|توزيع)/.test(q))return answer("الشحنات غير المسندة: "+(stats.byDriver["(unassigned)"]||0));
 if(/(cod|تحصيل|فلوس)/.test(q))return answer("إجمالي COD الظاهر في الأوردرات: "+(stats.codDueCents/100).toFixed(2)+" جنيه. هذا ليس إثبات تحصيل فعلي.");
 if(/(منطقة|area)/.test(q))return answer(Object.entries(stats.byArea).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>name+": "+count).join("، "));
 if(/(ملخص|عدد|اجمالي|إجمالي|total)/.test(q))return answer("إجمالي "+stats.total+"، مسلمة "+stats.delivered+"، استثناءات "+stats.exception+"، نشطة "+stats.active);
 return answer("اسأل عن الملخص أو التسليم أو المرتجعات أو المندوبين أو المناطق أو COD.");
}

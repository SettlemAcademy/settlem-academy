(function(){
  const api=(window.SettlemAPI&&SettlemAPI.request)?SettlemAPI.request:null;
  const keys=['nav_home','nav_courses','nav_learning','nav_resources','nav_tests','nav_dashboard','nav_plans','nav_about','nav_contact','nav_cta_label','nav_home_url','nav_courses_url','nav_learning_url','nav_resources_url','nav_tests_url','nav_dashboard_url','nav_plans_url','nav_about_url','nav_contact_url','nav_cta_url','footer_tagline','footer_copyright'];
  if(!api)return;
  api('/settings?keys='+encodeURIComponent(keys.join(','))).then(d=>{
    const links=[...document.querySelectorAll('nav .links a')];
    const map=[['nav_home','nav_home_url'],['nav_courses','nav_courses_url'],['nav_learning','nav_learning_url'],['nav_resources','nav_resources_url'],['nav_tests','nav_tests_url'],['nav_dashboard','nav_dashboard_url'],['nav_plans','nav_plans_url'],['nav_about','nav_about_url'],['nav_contact','nav_contact_url']];
    map.forEach((pair,i)=>{const a=links[i];if(!a)return;if(d[pair[0]])a.textContent=d[pair[0]];if(d[pair[1]])a.href=d[pair[1]]});
    const cta=document.querySelector('nav .navcta');if(cta){if(d.nav_cta_label)cta.textContent=d.nav_cta_label;if(d.nav_cta_url)cta.href=d.nav_cta_url}
    const foot=document.querySelector('footer');if(foot){const ps=foot.querySelectorAll('p');if(ps[0]&&d.footer_tagline)ps[0].textContent=d.footer_tagline;if(ps[ps.length-1]&&d.footer_copyright)ps[ps.length-1].textContent=d.footer_copyright}
  }).catch(()=>{});
})();

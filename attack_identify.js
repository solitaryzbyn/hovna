(async (ModuleLoader) => {
    'use strict';

    //****************************** Configuration ******************************//
    // Nastaveno na průměr 8.5 minuty s velkým rozptylem (celkový rozsah 3 - 14 min)
    const mediumReloadTime = 510000; 
    const reloadTimeRange = 660000;
    //*************************** End Configuration ***************************//

    // Dependency loading
    await ModuleLoader.loadModule('utils/notify-utils');

    // Controls the window title
    TwFramework.setIdleTitlePreffix('IDENTIFIER', document.title);

    // Update page
    const intervalRange = Math.floor(Math.random() * reloadTimeRange + (mediumReloadTime - reloadTimeRange / 2));
    
    // Logování pro kontrolu v konzoli (F12), kdy proběhne další kontrola
    console.log(`[Identifier] Další kontrola proběhne za: ${Math.round(intervalRange / 1000 / 60 * 100) / 100} minut.`);

    setInterval(function () {
        $("#select_all").click();
    }, intervalRange);
    
    setInterval(function () {
        $('.btn[value=Etiqueta]').click();
        // Po kliknutí na označení se stránka za 2 sekundy obnoví, aby script mohl běžet znovu
        setTimeout(() => { window.location.reload(); }, 2000);
    }, intervalRange + 1000);

})({
    // ModuleLoader functions
    loadModule: moduleName => {
        return new Promise((resolve, reject) => {
            const modulePath = moduleName.replace('.', '/');
            const moduleUrl = `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${modulePath}.js`;
            console.debug('[TwScripts] Loading ', modulePath, ' from URL ', moduleUrl, '...');
            return $.ajax({
                    method: "GET",
                    url: moduleUrl,
                    dataType: "text"
                }).done(res => resolve(eval(res)))
                .fail(req => reject(console.error("[TwScripts] Fail loading module '", moduleName, "'.")));
        })
    }
});

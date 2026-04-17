
async function findThayla() {
    const { data, error } = await window.Sistema.supabase
        .from('usuarios')
        .select('id, nome')
        .ilike('nome', '%Thayla%');
    console.log("Thayla Search Result:", data, error);
}
// findThayla();

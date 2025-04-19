import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mtxcbdlsnbqfcvrxnthw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eGNiZGxzbmJxZmN2cnhudGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNzU5NTcsImV4cCI6MjA2MDY1MTk1N30.V6evZIuJAMg7yx70fyKI8xFhUlO4jOKx-Ycj_Luv_lE');

document.getElementById('anecdote-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!grecaptcha.getResponse()) {
    alert('Please complete the reCAPTCHA');
    return;
  }

  const formData = new FormData(e.target);
  const data = {
    date: formData.get('date'),
    location: formData.get('location'),
    description: formData.get('description'),
    entityType: formData.get('entityType'),
    witnessName: formData.get('witnessName'),
    contactInfo: formData.get('contactInfo'),
    media: formData.get('media')
  };

  const { data: source } = await supabase
    .from('Sources')
    .insert({
      type: 'anecdote',
      title: 'User Submission',
      author: data.witnessName || 'Anonymous',
      publication_date: new Date()
    })
    .select('source_id')
    .single();

  await supabase
    .from('Incidents')
    .insert({
      date: data.date,
      location: data.location,
      description: data.description,
      entity_type: data.entityType,
      tags: [data.entityType, 'sighting'],
      source_id: source.source_id
    });

  if (data.witnessName) {
    await supabase
      .from('Witnesses')
      .insert({
        name: data.witnessName,
        contact_info: data.contactInfo,
        incident_id: source.source_id
      });
  }

  if (data.media && data.media.size > 0) {
    const { data: media } = await supabase.storage
      .from('media')
      .upload(`incidents/${Date.now()}_${data.media.name}`, data.media);
    await supabase
      .from('Media')
      .insert({
        incident_id: source.source_id,
        file_url: media.path,
        media_type: data.media.type
      });
  }

  alert('Anecdote submitted!');
  e.target.reset();
});

document.getElementById('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const query = formData.get('query');
  const filters = {
    dateStart: formData.get('dateStart'),
    dateEnd: formData.get('dateEnd'),
    location: formData.get('location'),
    sourceType: formData.get('sourceType'),
    entityType: formData.get('entityType')
  };

  let dbQuery = supabase
    .from('Incidents')
    .select(`
      *,
      Sources (title, author, url, publication_date),
      Media (file_url, media_type)
    `);

  if (query) {
    dbQuery = dbQuery.ilike('description', `%${query}%`);
  }
  if (filters.dateStart) {
    dbQuery = dbQuery.gte('date', filters.dateStart);
  }
  if (filters.dateEnd) {
    dbQuery = dbQuery.lte('date', filters.dateEnd);
  }
  if (filters.location) {
    dbQuery = dbQuery.ilike('location', `%${filters.location}%`);
  }
  if (filters.sourceType) {
    dbQuery = dbQuery.eq('Sources.type', filters.sourceType);
  }
  if (filters.entityType) {
    dbQuery = dbQuery.eq('entity_type', filters.entityType);
  }

  const { data, error } = await dbQuery;
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = data.length ? data.map(item => `
    <div>
      <h3>${item.date} - ${item.location}</h3>
      <p>${item.description}</p>
      <p>Entity: ${item.entity_type}</p>
      <p>Source: <a href="${item.Sources.url}">${item.Sources.title}</a></p>
      ${item.Media ? `<p>Media: <a href="${item.Media.file_url}">${item.Media.media_type}</a></p>` : ''}
    </div>
  `).join('') : '<p>No results found.</p>';
});

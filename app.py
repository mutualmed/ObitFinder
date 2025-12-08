"""
=============================================================================
ObitFinder Pipeline CRM - Kanban-Based Workflow
=============================================================================
A Streamlit application for managing family outreach using a pipeline/kanban
workflow. Relatives (Contacts) are the "Leads" that move through stages.

Pipeline Stages: New -> Attempted -> In Progress -> Won / Lost

Key Feature: "One-Win, Close-All" - When a relative is marked "Won", all
other relatives linked to the same deceased are automatically marked "Lost".

Database Schema:
- casos (Deceased): id, nome, cidade, data_obito, link_fonte
- contatos (Relatives/Leads): id, nome, telefone_1-4, status, notes
- relacionamentos (Junction): id, caso_id, contato_id, tipo_parentesco
=============================================================================
"""

import streamlit as st
from supabase import create_client, Client
from datetime import datetime
from typing import Optional
import uuid

# =============================================================================
# CONFIGURATION
# =============================================================================

# Pipeline stages configuration
PIPELINE_STAGES = ['New', 'Attempted', 'In Progress', 'Won', 'Lost']
STAGE_COLORS = {
    'New': '🔵',
    'Attempted': '🟡', 
    'In Progress': '🟠',
    'Won': '🟢',
    'Lost': '🔴'
}
CARDS_PER_PAGE = 15  # Cards to load per column initially

# =============================================================================
# DATABASE CONNECTION (Singleton Pattern)
# =============================================================================

@st.cache_resource
def init_supabase_client() -> Client:
    """Initialize and cache the Supabase client."""
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)


def get_client() -> Client:
    """Wrapper to get the cached Supabase client."""
    return init_supabase_client()


# =============================================================================
# SCHEMA MIGRATION CHECK
# =============================================================================

def ensure_pipeline_schema(client: Client) -> bool:
    """
    Check if pipeline columns exist, prompt for migration if not.
    Returns True if schema is ready, False if migration needed.
    """
    try:
        # Test if status column exists by selecting it
        client.table('contatos').select('status').limit(1).execute()
        return True
    except Exception:
        st.error("⚠️ Pipeline schema not found. Please run the migration SQL first.")
        st.code("""
ALTER TABLE contatos
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE contatos SET status = 'New' WHERE status IS NULL;
        """, language="sql")
        return False


# =============================================================================
# SESSION STATE INITIALIZATION
# =============================================================================

def init_session_state():
    """Initialize all session state variables."""
    # Track loaded cards per stage (for pagination)
    if 'cards_loaded' not in st.session_state:
        st.session_state['cards_loaded'] = {stage: CARDS_PER_PAGE for stage in PIPELINE_STAGES}
    
    # Currently selected contact for detail view
    if 'selected_contact_id' not in st.session_state:
        st.session_state['selected_contact_id'] = None
    
    # Track if schema has been verified
    if 'schema_verified' not in st.session_state:
        st.session_state['schema_verified'] = False
    
    # Sidebar filters
    if 'filter_cidade' not in st.session_state:
        st.session_state['filter_cidade'] = ""
    
    # Force refresh flag
    if 'force_refresh' not in st.session_state:
        st.session_state['force_refresh'] = False


# =============================================================================
# DATA RETRIEVAL FUNCTIONS
# =============================================================================

def fetch_pipeline_cards(
    client: Client,
    status: str,
    limit: int,
    cidade_filter: Optional[str] = None
) -> list[dict]:
    """
    Fetch contacts (leads) for a specific pipeline stage.
    Includes deceased info via relacionamentos join.
    
    Returns list of cards with: contact info + deceased context
    """
    # Query relacionamentos to get contacts with their linked casos
    query = client.table('relacionamentos').select(
        'id, tipo_parentesco, caso_id, '
        'contatos!inner(id, nome, telefone_1, telefone_2, telefone_3, telefone_4, status, notes), '
        'casos(id, nome, cidade, data_obito)'
    ).eq('contatos.status', status)
    
    # Apply city filter on the caso
    if cidade_filter and cidade_filter.strip():
        query = query.ilike('casos.cidade', f'%{cidade_filter.strip()}%')
    
    query = query.limit(limit)
    
    response = query.execute()
    
    # Flatten and structure the response
    cards = []
    seen_contacts = set()  # Avoid duplicates if contact has multiple relationships
    
    for rel in response.data or []:
        contato = rel.get('contatos', {})
        caso = rel.get('casos', {})
        
        if not contato or contato['id'] in seen_contacts:
            continue
        
        seen_contacts.add(contato['id'])
        
        # Aggregate phone numbers
        phones = [contato.get(f'telefone_{i}', '') for i in range(1, 5)]
        phone_display = next((p for p in phones if p and p.strip()), 'No phone')
        
        cards.append({
            'contato_id': contato['id'],
            'contato_nome': contato.get('nome', 'Unknown'),
            'phone_display': phone_display,
            'all_phones': ', '.join([p for p in phones if p and p.strip()]),
            'status': contato.get('status', 'New'),
            'notes': contato.get('notes', ''),
            'caso_id': caso.get('id') if caso else None,
            'caso_nome': caso.get('nome', 'Unknown') if caso else 'No linked case',
            'caso_cidade': caso.get('cidade', '') if caso else '',
            'caso_data_obito': caso.get('data_obito', '')[:10] if caso and caso.get('data_obito') else '',
            'tipo_parentesco': rel.get('tipo_parentesco', '')
        })
    
    return cards


def fetch_contact_details(client: Client, contato_id: str) -> Optional[dict]:
    """Fetch full details for a specific contact."""
    # Get contact info
    contact_resp = client.table('contatos').select('*').eq('id', contato_id).single().execute()
    
    if not contact_resp.data:
        return None
    
    contact = contact_resp.data
    
    # Get related caso info via relacionamentos
    rel_resp = client.table('relacionamentos').select(
        'tipo_parentesco, casos(id, nome, cidade, data_obito, link_fonte)'
    ).eq('contato_id', contato_id).execute()
    
    caso_info = None
    parentesco = ''
    if rel_resp.data:
        rel = rel_resp.data[0]
        caso_info = rel.get('casos', {})
        parentesco = rel.get('tipo_parentesco', '')
    
    return {
        'contact': contact,
        'caso': caso_info,
        'parentesco': parentesco
    }


def get_stage_counts(client: Client) -> dict[str, int]:
    """Get count of contacts in each pipeline stage."""
    counts = {}
    for stage in PIPELINE_STAGES:
        resp = client.table('contatos').select('id', count='exact').eq('status', stage).execute()
        counts[stage] = resp.count if resp.count else 0
    return counts


# =============================================================================
# WRITE-BACK FUNCTIONS
# =============================================================================

def update_contact_status(client: Client, contato_id: str, new_status: str) -> bool:
    """Update a contact's pipeline status."""
    try:
        client.table('contatos').update({
            'status': new_status,
            'status_updated_at': datetime.now().isoformat()
        }).eq('id', contato_id).execute()
        return True
    except Exception as e:
        st.error(f"Failed to update status: {str(e)}")
        return False


def update_contact_notes(client: Client, contato_id: str, notes: str) -> bool:
    """Update a contact's notes."""
    try:
        client.table('contatos').update({
            'notes': notes
        }).eq('id', contato_id).execute()
        return True
    except Exception as e:
        st.error(f"Failed to update notes: {str(e)}")
        return False


def one_win_close_all(client: Client, winner_contato_id: str) -> int:
    """
    THE CRUCIAL BUSINESS RULE: One-Win, Close-All
    
    When a relative is marked "Won":
    1. Find the caso_id linked to this relative
    2. Find ALL other relatives linked to that same caso_id
    3. Mark them all as "Lost"
    
    Returns the number of relatives closed.
    """
    # Step 1: Find the caso_id for this winning contact
    rel_resp = client.table('relacionamentos').select('caso_id').eq('contato_id', winner_contato_id).execute()
    
    if not rel_resp.data:
        return 0
    
    caso_id = rel_resp.data[0]['caso_id']
    
    # Step 2: Find ALL other contato_ids linked to this caso
    all_rels = client.table('relacionamentos').select('contato_id').eq('caso_id', caso_id).execute()
    
    closed_count = 0
    for rel in all_rels.data or []:
        other_contato_id = rel['contato_id']
        
        # Skip the winner
        if other_contato_id == winner_contato_id:
            continue
        
        # Step 3: Mark as Lost (unless already Won or Lost)
        # First check current status
        status_resp = client.table('contatos').select('status').eq('id', other_contato_id).single().execute()
        
        if status_resp.data and status_resp.data['status'] not in ['Won', 'Lost']:
            client.table('contatos').update({
                'status': 'Lost',
                'notes': (status_resp.data.get('notes', '') or '') + f"\n[Auto-closed: Another relative won on {datetime.now().strftime('%Y-%m-%d %H:%M')}]",
                'status_updated_at': datetime.now().isoformat()
            }).eq('id', other_contato_id).execute()
            closed_count += 1
    
    return closed_count


def move_to_stage(client: Client, contato_id: str, new_status: str) -> tuple[bool, str]:
    """
    Move a contact to a new pipeline stage.
    Handles the One-Win-Close-All logic if moving to Won.
    
    Returns (success, message)
    """
    # If moving to Won, trigger the close-all logic
    if new_status == 'Won':
        # First update the winner
        success = update_contact_status(client, contato_id, 'Won')
        if success:
            closed = one_win_close_all(client, contato_id)
            return True, f"✅ Marked as Won! {closed} other relative(s) automatically closed."
        return False, "Failed to update status"
    else:
        # Normal status update
        success = update_contact_status(client, contato_id, new_status)
        if success:
            return True, f"✅ Moved to {new_status}"
        return False, "Failed to update status"


# =============================================================================
# FILE UPLOAD FUNCTIONS
# =============================================================================

def upload_file_to_storage(client: Client, caso_id: str, file) -> Optional[str]:
    """
    Upload a file to Supabase Storage bucket 'case_files'.
    Files are organized by caso_id.
    
    Returns the file path if successful, None otherwise.
    """
    if not file or not caso_id:
        return None
    
    try:
        # Generate unique filename
        file_ext = file.name.split('.')[-1] if '.' in file.name else 'bin'
        unique_name = f"{caso_id}/{uuid.uuid4().hex[:8]}_{file.name}"
        
        # Upload to storage
        client.storage.from_('case_files').upload(
            path=unique_name,
            file=file.getvalue(),
            file_options={"content-type": file.type}
        )
        
        return unique_name
    except Exception as e:
        st.error(f"Upload failed: {str(e)}")
        return None


def list_case_files(client: Client, caso_id: str) -> list[dict]:
    """List all files uploaded for a specific case."""
    try:
        files = client.storage.from_('case_files').list(path=caso_id)
        return files or []
    except Exception:
        return []


# =============================================================================
# UI COMPONENTS
# =============================================================================

def render_sidebar(client: Client) -> str:
    """Render sidebar with filters and stats."""
    st.sidebar.header("📊 Pipeline Overview")
    
    # Show stage counts
    counts = get_stage_counts(client)
    
    cols = st.sidebar.columns(len(PIPELINE_STAGES))
    for i, stage in enumerate(PIPELINE_STAGES):
        with cols[i]:
            st.metric(
                STAGE_COLORS.get(stage, '⚪'),
                counts.get(stage, 0),
                help=stage
            )
    
    st.sidebar.divider()
    
    # Filters
    st.sidebar.header("🔍 Filters")
    cidade_filter = st.sidebar.text_input(
        "Filter by City",
        value=st.session_state.get('filter_cidade', ''),
        placeholder="Enter city name..."
    )
    st.session_state['filter_cidade'] = cidade_filter
    
    st.sidebar.divider()
    
    # Refresh button
    if st.sidebar.button("🔄 Refresh Pipeline", use_container_width=True):
        st.session_state['force_refresh'] = True
        st.rerun()
    
    return cidade_filter


def render_contact_card(card: dict, stage: str):
    """Render a single contact card in the pipeline."""
    with st.container(border=True):
        # Card header - Contact name
        st.markdown(f"**{card['contato_nome']}**")
        
        # Phone number
        st.caption(f"📞 {card['phone_display']}")
        
        # Deceased context
        st.caption(f"⚰️ {card['caso_nome']}")
        if card['tipo_parentesco']:
            st.caption(f"👤 {card['tipo_parentesco']}")
        
        # Select button
        if st.button("View Details", key=f"card_{card['contato_id']}", use_container_width=True):
            st.session_state['selected_contact_id'] = card['contato_id']
            st.rerun()


def render_pipeline_column(client: Client, stage: str, cidade_filter: str):
    """Render a single pipeline column."""
    # Column header
    count_resp = client.table('contatos').select('id', count='exact').eq('status', stage).execute()
    count = count_resp.count if count_resp.count else 0
    
    st.markdown(f"### {STAGE_COLORS.get(stage, '⚪')} {stage} ({count})")
    
    # Fetch cards for this stage
    limit = st.session_state['cards_loaded'].get(stage, CARDS_PER_PAGE)
    cards = fetch_pipeline_cards(client, stage, limit, cidade_filter)
    
    # Render cards
    if not cards:
        st.caption("No contacts in this stage")
    else:
        for card in cards:
            render_contact_card(card, stage)
    
    # Load more button
    if len(cards) >= limit:
        if st.button(f"Load More", key=f"load_more_{stage}", use_container_width=True):
            st.session_state['cards_loaded'][stage] += CARDS_PER_PAGE
            st.rerun()


def render_detail_view(client: Client):
    """Render the detail view for a selected contact."""
    contato_id = st.session_state.get('selected_contact_id')
    
    if not contato_id:
        return
    
    details = fetch_contact_details(client, contato_id)
    
    if not details:
        st.error("Contact not found")
        return
    
    contact = details['contact']
    caso = details['caso']
    parentesco = details['parentesco']
    
    # Detail panel
    st.sidebar.divider()
    st.sidebar.header("📋 Contact Details")
    
    # Close button
    if st.sidebar.button("✖️ Close", use_container_width=True):
        st.session_state['selected_contact_id'] = None
        st.rerun()
    
    # Contact info
    st.sidebar.subheader(contact.get('nome', 'Unknown'))
    st.sidebar.caption(f"Status: **{contact.get('status', 'New')}**")
    
    # Phone numbers
    phones = []
    for i in range(1, 5):
        phone = contact.get(f'telefone_{i}', '')
        if phone and phone.strip():
            phones.append(phone)
    
    if phones:
        st.sidebar.markdown("**📞 Phone Numbers:**")
        for phone in phones:
            st.sidebar.code(phone)
    
    # Relationship info
    if parentesco:
        st.sidebar.markdown(f"**Relationship:** {parentesco}")
    
    # Deceased info
    if caso:
        st.sidebar.divider()
        st.sidebar.markdown("**⚰️ Deceased Information:**")
        st.sidebar.write(f"Name: {caso.get('nome', 'N/A')}")
        st.sidebar.write(f"City: {caso.get('cidade', 'N/A')}")
        st.sidebar.write(f"Date: {caso.get('data_obito', 'N/A')[:10] if caso.get('data_obito') else 'N/A'}")
        if caso.get('link_fonte'):
            st.sidebar.markdown(f"[🔗 Source Link]({caso['link_fonte']})")
    
    # === ACTIONS ===
    st.sidebar.divider()
    st.sidebar.markdown("**🎯 Actions:**")
    
    # Move stage dropdown
    current_status = contact.get('status', 'New')
    other_stages = [s for s in PIPELINE_STAGES if s != current_status]
    
    new_stage = st.sidebar.selectbox(
        "Move to Stage",
        options=["-- Select --"] + other_stages,
        key="move_stage_select"
    )
    
    if new_stage and new_stage != "-- Select --":
        if st.sidebar.button(f"Move to {new_stage}", type="primary", use_container_width=True):
            success, message = move_to_stage(client, contato_id, new_stage)
            if success:
                st.sidebar.success(message)
                st.session_state['selected_contact_id'] = None
                st.rerun()
            else:
                st.sidebar.error(message)
    
    # Quick action buttons
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if current_status != 'Won':
            if st.button("🏆 Won", use_container_width=True, key="quick_won"):
                success, message = move_to_stage(client, contato_id, 'Won')
                if success:
                    st.toast(message)
                    st.session_state['selected_contact_id'] = None
                    st.rerun()
    with col2:
        if current_status != 'Lost':
            if st.button("❌ Lost", use_container_width=True, key="quick_lost"):
                success, message = move_to_stage(client, contato_id, 'Lost')
                if success:
                    st.toast(message)
                    st.session_state['selected_contact_id'] = None
                    st.rerun()
    
    # Notes section
    st.sidebar.divider()
    st.sidebar.markdown("**📝 Notes:**")
    
    current_notes = contact.get('notes', '') or ''
    new_notes = st.sidebar.text_area(
        "Call Log / Notes",
        value=current_notes,
        height=150,
        key="notes_input",
        label_visibility="collapsed"
    )
    
    if new_notes != current_notes:
        if st.sidebar.button("💾 Save Notes", use_container_width=True):
            if update_contact_notes(client, contato_id, new_notes):
                st.sidebar.success("Notes saved!")
                st.rerun()
    
    # File upload section
    if caso and caso.get('id'):
        st.sidebar.divider()
        st.sidebar.markdown("**📁 Documents:**")
        
        # List existing files
        files = list_case_files(client, caso['id'])
        if files:
            for f in files[:5]:  # Show first 5
                st.sidebar.caption(f"📄 {f.get('name', 'file')}")
        
        # Upload new file
        uploaded_file = st.sidebar.file_uploader(
            "Upload Document",
            type=['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'],
            key="file_uploader"
        )
        
        if uploaded_file:
            if st.sidebar.button("📤 Upload", use_container_width=True):
                path = upload_file_to_storage(client, caso['id'], uploaded_file)
                if path:
                    st.sidebar.success(f"Uploaded: {uploaded_file.name}")
                    st.rerun()


# =============================================================================
# MAIN APPLICATION
# =============================================================================

def main():
    """Main application entry point."""
    
    # Page configuration
    st.set_page_config(
        page_title="ObitFinder Pipeline CRM",
        page_icon="📊",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # App title
    st.title("📊 ObitFinder Pipeline CRM")
    st.caption("Kanban-based workflow for family outreach management")
    
    # Initialize session state
    init_session_state()
    
    # Initialize Supabase client
    try:
        client = get_client()
    except Exception as e:
        st.error(f"❌ Failed to connect to Supabase: {str(e)}")
        st.info("Please check your `.streamlit/secrets.toml` file.")
        st.stop()
    
    # Verify schema (once per session)
    if not st.session_state['schema_verified']:
        if not ensure_pipeline_schema(client):
            st.stop()
        st.session_state['schema_verified'] = True
    
    # Render sidebar and get filters
    cidade_filter = render_sidebar(client)
    
    # Render detail view if a contact is selected
    render_detail_view(client)
    
    # === KANBAN BOARD ===
    st.divider()
    
    # Create columns for each pipeline stage
    columns = st.columns(len(PIPELINE_STAGES))
    
    for i, stage in enumerate(PIPELINE_STAGES):
        with columns[i]:
            render_pipeline_column(client, stage, cidade_filter)


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    main()

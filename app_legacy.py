"""
=============================================================================
ObitFinder CRM - Family Outreach Management System
=============================================================================
A Streamlit application for managing family outreach for deceased individuals.
Connects directly to Supabase (PostgreSQL) for data persistence.

Database Schema:
- casos (Deceased): id, nome, cidade, data_obito, link_fonte
- contatos (Relatives): id, nome, telefone_1-4, contacted, notes
- relacionamentos (Junction): id, caso_id, contato_id, tipo_parentesco
=============================================================================
"""

import streamlit as st
from supabase import create_client, Client
from datetime import datetime, date
from typing import Optional
import pandas as pd

# =============================================================================
# CONFIGURATION
# =============================================================================

PAGE_SIZE = 20  # Number of casos per page

# =============================================================================
# DATABASE CONNECTION (Singleton Pattern)
# =============================================================================

@st.cache_resource
def init_supabase_client() -> Client:
    """
    Initialize and cache the Supabase client.
    Uses st.secrets for secure credential management.
    Returns a singleton instance across all reruns.
    """
    url = st.secrets["SUPABASE_URL"]
    key = st.secrets["SUPABASE_KEY"]
    return create_client(url, key)


def get_client() -> Client:
    """Wrapper to get the cached Supabase client."""
    return init_supabase_client()


# =============================================================================
# SCHEMA MIGRATION
# =============================================================================

def ensure_crm_columns_exist(client: Client) -> bool:
    """
    Check and add CRM columns (contacted, notes) to contatos table if missing.
    This runs once on app startup to ensure schema compatibility.
    
    Returns:
        bool: True if migration was performed, False if columns already existed.
    """
    migration_sql = """
    ALTER TABLE contatos
    ADD COLUMN IF NOT EXISTS contacted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notes TEXT;
    """
    
    try:
        # Execute the migration SQL via Supabase's RPC or direct query
        # Using rpc to execute raw SQL
        client.rpc('exec_sql', {'query': migration_sql}).execute()
        return True
    except Exception as e:
        # If RPC doesn't exist, try alternative approach
        # The columns might already exist, which is fine
        error_msg = str(e)
        if "already exists" in error_msg.lower():
            return False
        # For Supabase, we'll check by attempting to select the columns
        try:
            # Test if columns exist by selecting them
            client.table('contatos').select('contacted, notes').limit(1).execute()
            return False  # Columns exist
        except Exception:
            # Columns don't exist - need manual migration
            st.warning(
                "⚠️ CRM columns (contacted, notes) may need to be added manually. "
                "Please run this SQL in your Supabase SQL Editor:\n\n"
                f"```sql\n{migration_sql}\n```"
            )
            return False


# =============================================================================
# SESSION STATE INITIALIZATION
# =============================================================================

def init_session_state():
    """
    Initialize all session state variables on first load.
    This ensures consistent state across app reruns.
    """
    # Pagination state
    if 'page_offset' not in st.session_state:
        st.session_state['page_offset'] = 0
    
    # Selected caso for detail view
    if 'selected_caso_id' not in st.session_state:
        st.session_state['selected_caso_id'] = None
    
    # Track if migration check has been done
    if 'migration_checked' not in st.session_state:
        st.session_state['migration_checked'] = False
    
    # Filter states
    if 'filter_cidade' not in st.session_state:
        st.session_state['filter_cidade'] = ""
    
    if 'filter_date_start' not in st.session_state:
        st.session_state['filter_date_start'] = None
    
    if 'filter_date_end' not in st.session_state:
        st.session_state['filter_date_end'] = None
    
    # Track previous editor state for change detection
    if 'previous_editor_data' not in st.session_state:
        st.session_state['previous_editor_data'] = None


# =============================================================================
# DATA RETRIEVAL FUNCTIONS
# =============================================================================

def fetch_casos_paginated(
    client: Client,
    offset: int,
    limit: int = PAGE_SIZE,
    cidade_filter: Optional[str] = None,
    date_start: Optional[date] = None,
    date_end: Optional[date] = None
) -> tuple[list[dict], int]:
    """
    Fetch casos (deceased records) with server-side pagination and filtering.
    
    Args:
        client: Supabase client instance
        offset: Number of records to skip (for pagination)
        limit: Maximum records to return per page
        cidade_filter: Optional city name filter (partial match)
        date_start: Optional start date for data_obito filter
        date_end: Optional end date for data_obito filter
    
    Returns:
        Tuple of (list of caso records, total count for pagination)
    """
    # Build the query with filters
    query = client.table('casos').select('*', count='exact')
    
    # Apply cidade filter (case-insensitive partial match)
    if cidade_filter and cidade_filter.strip():
        query = query.ilike('cidade', f'%{cidade_filter.strip()}%')
    
    # Apply date range filters
    if date_start:
        query = query.gte('data_obito', date_start.isoformat())
    
    if date_end:
        # Add one day to include the end date fully
        query = query.lte('data_obito', date_end.isoformat() + 'T23:59:59')
    
    # Apply ordering and pagination
    query = query.order('data_obito', desc=True).range(offset, offset + limit - 1)
    
    response = query.execute()
    
    total_count = response.count if response.count else 0
    return response.data or [], total_count


def fetch_relatives_for_caso(client: Client, caso_id: str) -> list[dict]:
    """
    Fetch all relatives (contatos) associated with a specific caso.
    Uses the relacionamentos junction table to link casos to contatos.
    
    Args:
        client: Supabase client instance
        caso_id: UUID of the selected caso
    
    Returns:
        List of relative records with relationship type
    """
    # Join relacionamentos with contatos to get full relative info
    response = client.table('relacionamentos').select(
        'id, tipo_parentesco, contato_id, '
        'contatos(id, nome, telefone_1, telefone_2, telefone_3, telefone_4, contacted, notes)'
    ).eq('caso_id', caso_id).execute()
    
    # Flatten the nested response structure
    relatives = []
    for rel in response.data or []:
        contato = rel.get('contatos', {})
        if contato:
            relatives.append({
                'rel_id': rel['id'],
                'contato_id': contato['id'],
                'nome': contato.get('nome', ''),
                'tipo_parentesco': rel.get('tipo_parentesco', ''),
                'telefone_1': contato.get('telefone_1', ''),
                'telefone_2': contato.get('telefone_2', ''),
                'telefone_3': contato.get('telefone_3', ''),
                'telefone_4': contato.get('telefone_4', ''),
                'contacted': contato.get('contacted', False) or False,
                'notes': contato.get('notes', '') or ''
            })
    
    return relatives


# =============================================================================
# DATA TRANSFORMATION FUNCTIONS
# =============================================================================

def aggregate_phone_numbers(
    telefone_1: str,
    telefone_2: str,
    telefone_3: str,
    telefone_4: str
) -> str:
    """
    Concatenate phone number fields into a single comma-separated string.
    Only includes non-empty values for clean display.
    
    Args:
        telefone_1-4: Individual phone number fields
    
    Returns:
        Comma-separated string of valid phone numbers (e.g., "555-1234, 555-5678")
    """
    phones = [telefone_1, telefone_2, telefone_3, telefone_4]
    # Filter out None, empty strings, and whitespace-only values
    valid_phones = [p.strip() for p in phones if p and p.strip()]
    return ', '.join(valid_phones)


def prepare_relatives_dataframe(relatives: list[dict]) -> pd.DataFrame:
    """
    Transform relative records into a DataFrame suitable for st.data_editor.
    Aggregates phone numbers and structures columns for display.
    
    Args:
        relatives: List of relative dictionaries from fetch_relatives_for_caso
    
    Returns:
        DataFrame with columns properly formatted for the CRM editor
    """
    if not relatives:
        return pd.DataFrame()
    
    # Process each relative and aggregate phones
    processed = []
    for rel in relatives:
        processed.append({
            'contato_id': rel['contato_id'],  # Hidden, used for updates
            'nome': rel['nome'],
            'tipo_parentesco': rel['tipo_parentesco'],
            'telefones': aggregate_phone_numbers(
                rel.get('telefone_1', ''),
                rel.get('telefone_2', ''),
                rel.get('telefone_3', ''),
                rel.get('telefone_4', '')
            ),
            'contacted': rel['contacted'],
            'notes': rel['notes']
        })
    
    return pd.DataFrame(processed)


# =============================================================================
# WRITE-BACK (PERSISTENCE) FUNCTIONS
# =============================================================================

def update_contato_crm_fields(
    client: Client,
    contato_id: str,
    contacted: bool,
    notes: str
) -> bool:
    """
    Update CRM fields for a specific contato record.
    
    Args:
        client: Supabase client instance
        contato_id: UUID of the contato to update
        contacted: New value for contacted boolean
        notes: New value for notes text
    
    Returns:
        True if update succeeded, False otherwise
    """
    try:
        client.table('contatos').update({
            'contacted': contacted,
            'notes': notes
        }).eq('id', contato_id).execute()
        return True
    except Exception as e:
        st.error(f"Failed to update contact: {str(e)}")
        return False


def detect_and_save_changes(
    client: Client,
    edited_df: pd.DataFrame,
    original_df: pd.DataFrame
):
    """
    Compare edited DataFrame with original to detect changes and persist them.
    Triggered when st.data_editor content is modified.
    
    Args:
        client: Supabase client instance
        edited_df: DataFrame after user edits
        original_df: DataFrame before user edits
    """
    if edited_df is None or original_df is None:
        return
    
    if edited_df.empty or original_df.empty:
        return
    
    # Compare row by row using contato_id as the key
    changes_made = 0
    
    for idx, edited_row in edited_df.iterrows():
        contato_id = edited_row['contato_id']
        
        # Find corresponding original row
        original_rows = original_df[original_df['contato_id'] == contato_id]
        if original_rows.empty:
            continue
        
        original_row = original_rows.iloc[0]
        
        # Check if contacted or notes changed
        contacted_changed = edited_row['contacted'] != original_row['contacted']
        notes_changed = edited_row['notes'] != original_row['notes']
        
        if contacted_changed or notes_changed:
            success = update_contato_crm_fields(
                client,
                contato_id,
                bool(edited_row['contacted']),
                str(edited_row['notes']) if edited_row['notes'] else ''
            )
            if success:
                changes_made += 1
    
    if changes_made > 0:
        st.toast(f"✅ Saved {changes_made} change(s) to database", icon="💾")


# =============================================================================
# UI COMPONENTS
# =============================================================================

def render_sidebar(client: Client) -> tuple[str, Optional[date], Optional[date]]:
    """
    Render the sidebar with filters and pagination controls.
    
    Returns:
        Tuple of (cidade_filter, date_start, date_end)
    """
    st.sidebar.header("🔍 Filters")
    
    # City filter
    cidade_filter = st.sidebar.text_input(
        "City (cidade)",
        value=st.session_state.get('filter_cidade', ''),
        placeholder="Enter city name...",
        key="cidade_input"
    )
    
    # Date range filter
    st.sidebar.subheader("Date of Death (data_obito)")
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        date_start = st.date_input(
            "From",
            value=st.session_state.get('filter_date_start'),
            key="date_start_input"
        )
    with col2:
        date_end = st.date_input(
            "To",
            value=st.session_state.get('filter_date_end'),
            key="date_end_input"
        )
    
    # Handle "clear" for date inputs (when user clears the date)
    if date_start == date(1970, 1, 1):
        date_start = None
    if date_end == date(1970, 1, 1):
        date_end = None
    
    st.sidebar.divider()
    
    # Pagination controls
    st.sidebar.subheader("📄 Pagination")
    
    current_page = (st.session_state['page_offset'] // PAGE_SIZE) + 1
    st.sidebar.write(f"Current Page: **{current_page}**")
    
    col1, col2 = st.sidebar.columns(2)
    
    with col1:
        if st.button("⬅️ Previous", use_container_width=True, disabled=st.session_state['page_offset'] == 0):
            st.session_state['page_offset'] = max(0, st.session_state['page_offset'] - PAGE_SIZE)
            st.session_state['selected_caso_id'] = None  # Reset selection on page change
            st.rerun()
    
    with col2:
        # We'll enable/disable this based on whether there are more records
        if st.button("Next ➡️", use_container_width=True, key="next_page"):
            st.session_state['page_offset'] += PAGE_SIZE
            st.session_state['selected_caso_id'] = None  # Reset selection on page change
            st.rerun()
    
    # Reset filters button
    st.sidebar.divider()
    if st.sidebar.button("🔄 Reset All Filters", use_container_width=True):
        st.session_state['page_offset'] = 0
        st.session_state['filter_cidade'] = ""
        st.session_state['filter_date_start'] = None
        st.session_state['filter_date_end'] = None
        st.session_state['selected_caso_id'] = None
        st.rerun()
    
    # Update session state with current filter values
    st.session_state['filter_cidade'] = cidade_filter
    st.session_state['filter_date_start'] = date_start
    st.session_state['filter_date_end'] = date_end
    
    return cidade_filter, date_start, date_end


def render_master_view(casos: list[dict], total_count: int) -> Optional[str]:
    """
    Render the master view showing paginated casos with selection.
    
    Args:
        casos: List of caso records for current page
        total_count: Total number of casos (for pagination info)
    
    Returns:
        Selected caso_id or None if no selection
    """
    st.header("📋 Deceased Records (Casos)")
    
    # Display pagination info
    start_idx = st.session_state['page_offset'] + 1
    end_idx = min(st.session_state['page_offset'] + len(casos), total_count)
    st.caption(f"Showing {start_idx}-{end_idx} of {total_count} records")
    
    if not casos:
        st.info("No records found. Try adjusting your filters.")
        return None
    
    # Create selection options with meaningful display
    options = {
        caso['id']: f"{caso.get('nome', 'Unknown')} - {caso.get('cidade', 'N/A')} ({caso.get('data_obito', 'N/A')[:10] if caso.get('data_obito') else 'N/A'})"
        for caso in casos
    }
    
    # Add a "none selected" option
    display_options = ["-- Select a deceased person --"] + list(options.values())
    id_list = [None] + list(options.keys())
    
    # Determine default index
    default_idx = 0
    if st.session_state.get('selected_caso_id') in id_list:
        default_idx = id_list.index(st.session_state['selected_caso_id'])
    
    selected_display = st.selectbox(
        "Select Deceased Individual",
        options=display_options,
        index=default_idx,
        key="caso_selector"
    )
    
    # Map selection back to ID
    if selected_display and selected_display != "-- Select a deceased person --":
        selected_idx = display_options.index(selected_display)
        selected_id = id_list[selected_idx]
        st.session_state['selected_caso_id'] = selected_id
        return selected_id
    
    st.session_state['selected_caso_id'] = None
    return None


def render_detail_view(client: Client, caso_id: str, caso_info: dict):
    """
    Render the detail view (CRM Editor) for relatives of a selected caso.
    
    Args:
        client: Supabase client instance
        caso_id: UUID of the selected caso
        caso_info: Dictionary with caso details for display
    """
    st.divider()
    st.header("👥 Relatives (CRM Editor)")
    
    # Display caso info
    st.subheader(f"Deceased: {caso_info.get('nome', 'Unknown')}")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("City", caso_info.get('cidade', 'N/A'))
    with col2:
        death_date = caso_info.get('data_obito', '')
        if death_date:
            death_date = death_date[:10]  # Truncate to date only
        st.metric("Date of Death", death_date or 'N/A')
    with col3:
        if caso_info.get('link_fonte'):
            st.markdown(f"[🔗 Source Link]({caso_info['link_fonte']})")
    
    st.divider()
    
    # Fetch relatives
    relatives = fetch_relatives_for_caso(client, caso_id)
    
    if not relatives:
        st.info("No relatives found for this deceased person.")
        return
    
    # Prepare DataFrame for editor
    df = prepare_relatives_dataframe(relatives)
    
    # Store original state for change detection
    original_df = df.copy()
    
    # Configure column display
    column_config = {
        'contato_id': None,  # Hide the ID column
        'nome': st.column_config.TextColumn(
            'Name',
            disabled=True,  # Read-only
            width='medium'
        ),
        'tipo_parentesco': st.column_config.TextColumn(
            'Relationship',
            disabled=True,  # Read-only
            width='small'
        ),
        'telefones': st.column_config.TextColumn(
            'Phone Numbers',
            disabled=True,  # Read-only
            width='large'
        ),
        'contacted': st.column_config.CheckboxColumn(
            'Contacted',
            default=False,
            width='small'
        ),
        'notes': st.column_config.TextColumn(
            'Notes',
            width='large'
        )
    }
    
    # Render the data editor
    edited_df = st.data_editor(
        df,
        column_config=column_config,
        use_container_width=True,
        hide_index=True,
        num_rows='fixed',  # Don't allow adding/removing rows
        key=f"editor_{caso_id}"
    )
    
    # Detect and save changes
    detect_and_save_changes(client, edited_df, original_df)


# =============================================================================
# MAIN APPLICATION
# =============================================================================

def main():
    """Main application entry point."""
    
    # Page configuration
    st.set_page_config(
        page_title="ObitFinder CRM",
        page_icon="📋",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # App title
    st.title("📋 ObitFinder CRM")
    st.caption("Family Outreach Management System")
    
    # Initialize session state
    init_session_state()
    
    # Initialize Supabase client
    try:
        client = get_client()
    except Exception as e:
        st.error(f"❌ Failed to connect to Supabase: {str(e)}")
        st.info("Please check your `.streamlit/secrets.toml` file contains valid SUPABASE_URL and SUPABASE_KEY.")
        st.stop()
    
    # Run schema migration check (once per session)
    if not st.session_state['migration_checked']:
        with st.spinner("Checking database schema..."):
            migration_performed = ensure_crm_columns_exist(client)
            if migration_performed:
                st.success("✅ CRM columns (contacted, notes) have been added to the database.")
            st.session_state['migration_checked'] = True
    
    # Render sidebar and get filter values
    cidade_filter, date_start, date_end = render_sidebar(client)
    
    # Initialize variables
    casos = []
    total_count = 0
    
    # Fetch paginated casos with filters
    try:
        casos, total_count = fetch_casos_paginated(
            client,
            offset=st.session_state['page_offset'],
            limit=PAGE_SIZE,
            cidade_filter=cidade_filter,
            date_start=date_start,
            date_end=date_end
        )
    except Exception as e:
        st.error(f"❌ Failed to fetch cases: {str(e)}")
        # Don't stop here, just show empty state so the UI doesn't crash
    
    # Disable "Next" button if we've reached the end
    if st.session_state['page_offset'] + PAGE_SIZE >= total_count:
        # Update the sidebar to reflect this (handled by button disabled state)
        pass
    
    # Render master view
    selected_caso_id = render_master_view(casos, total_count)
    
    # Render detail view if a caso is selected
    if selected_caso_id:
        # Find the caso info from the list
        caso_info = next((c for c in casos if c['id'] == selected_caso_id), {})
        render_detail_view(client, selected_caso_id, caso_info)


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    main()

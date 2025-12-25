"""
Stage state machine validation
Valid transitions: planned -> in_progress -> done
"""

VALID_TRANSITIONS = {
    "planned": ["in_progress"],
    "in_progress": ["done"],
    "done": []  # Terminal state
}

def validate_state_transition(current_status: str, new_status: str) -> bool:
    """
    State geçişinin geçerli olup olmadığını kontrol eder
    
    Args:
        current_status: Mevcut durum
        new_status: Yeni durum
    
    Returns:
        bool: Geçiş geçerliyse True
    
    Raises:
        ValueError: Geçiş geçersizse
    """
    if current_status not in VALID_TRANSITIONS:
        raise ValueError(f"Invalid current status: {current_status}")
    
    if new_status not in VALID_TRANSITIONS[current_status]:
        allowed = ", ".join(VALID_TRANSITIONS[current_status]) if VALID_TRANSITIONS[current_status] else "none"
        raise ValueError(
            f"Invalid state transition: {current_status} -> {new_status}. "
            f"Allowed transitions from '{current_status}': {allowed}"
        )
    
    return True

def get_allowed_transitions(current_status: str) -> list:
    """Mevcut durumdan yapılabilecek geçişleri döndürür"""
    return VALID_TRANSITIONS.get(current_status, [])




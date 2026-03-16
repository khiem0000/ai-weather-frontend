# User Reply Feature Implementation - Frontend (Plan Approved)

## Status: [0/5] Completed

✅ **1. Create TODO.md** - *Done*

## Frontend Changes (index.html & main.js)
**2. Edit index.html** - Add reply box HTML after sp-chat-history  
**3. Edit js/main.js** - Replace showTicketDetail + add reply handler + currentTicketUserViewId  
**4. Test Support Modal Flow**  
   - Open Settings → Headset → Tab "Phản Hồi"  
   - Send test ticket → Lookup → View with admin_reply → Reply box appears?  
   - Test send button → Toast + refresh list?  
**5. Backend Integration** (separate repo)  
   - adminRoutes.js: Add `router.put('/support/user/:id/reply', ...)`  
   - adminController.js: Add `replySupportTicketUser()` - CONCAT message + status='pending'

**Next:** Confirm "✅ 2. Edit index.html" after tool success → "✅ 3. Edit js/main.js" → Test → Backend.


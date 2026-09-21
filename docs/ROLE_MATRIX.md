# Role matrix

| Capability | Admin | Dispatch | Warehouse | Finance | Driver | Customer |
| --- | --- | --- | --- | --- | --- | --- |
| View shipments | All | All | All | All | Assigned | Owned |
| Create booking / quote | Yes | Yes | No | No | No | Owned |
| Assign/retry shipment | Yes | Yes | No | No | No | No |
| Delivery status updates | Yes | Yes | No | No | Assigned | Cancel own BOOKED |
| Submit GPS position | No | No | No | No | Assigned active delivery | No |
| Plan routes | Yes | Yes | No | No | No | No |
| View/start/complete routes | All | All | No | No | Assigned | No |
| Fleet and maintenance | Yes | Yes | No | No | No | No |
| Hub custody scans | Yes | Yes | Yes | No | No | No |
| Create hubs | Yes | Yes | No | No | No | No |
| Invoice visibility | All | No | No | All | No | Owned |
| Record payment | Yes | No | No | Yes | No | No |
| Support tickets | All | All | No | No | No | Owned |
| Customer directory | Yes | Yes | No | Yes | No | No |
| Driver directory | Yes | Yes | No | No | No | No |
| Create staff / deactivate users | Yes | No | No | No | No | No |
| Settings / rate cards / audit | Yes | No | No | No | No | No |
| Reports / CSV | Yes | Yes | No | Yes | No | No |
| Notifications / password change | Own | Own | Own | Own | Own | Own |

Public tracking is unauthenticated and returns a limited status history. Drivers cannot self-assign. Only administrators create staff; public registration always creates a customer. Deactivating drivers with active deliveries is blocked. Users cannot deactivate their own account, and the last administrator is protected.

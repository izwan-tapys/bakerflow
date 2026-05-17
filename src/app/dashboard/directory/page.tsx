'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  Search, 
  Phone, 
  MapPin, 
  MessageCircle, 
  ShoppingBag, 
  DollarSign,
  ChevronRight,
  UserCheck
} from 'lucide-react';

interface CustomerContact {
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
}

export default function DirectoryPage() {
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch all orders to build unique customer contacts directory
        const { data: orders } = await supabase
          .from('orders')
          .select('customer_name, customer_phone, customer_address, total_amount')
          .eq('baker_id', user.id);

        if (orders) {
          // Aggregate orders by customer name & phone
          const customerMap: Record<string, CustomerContact> = {};

          orders.forEach(o => {
            if (!o.customer_name) return;
            // Create a unique key using name and phone
            const phoneClean = o.customer_phone || '';
            const key = `${o.customer_name.trim().toLowerCase()}-${phoneClean.trim()}`;

            if (!customerMap[key]) {
              customerMap[key] = {
                name: o.customer_name,
                phone: phoneClean,
                address: o.customer_address || 'No address provided',
                totalOrders: 0,
                totalSpent: 0
              };
            }

            customerMap[key].totalOrders += 1;
            customerMap[key].totalSpent += (o.total_amount || 0);
          });

          setContacts(Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent));
        }
      }
      setLoading(false);
    };

    fetchCustomers();
  }, []);

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  }, [contacts, searchQuery]);

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-black text-foreground">Directory</h1>
              <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Contacts & Customers</p>
            </div>
          </div>
          <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg uppercase">
            {filteredContacts.length} Record{filteredContacts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-foreground/30" />
          <input 
            type="text" 
            placeholder="Search by customer name or phone..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-muted bg-card focus:border-primary focus:outline-none font-bold text-sm"
          />
        </div>

        {/* Contacts list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted/50 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border-2 border-dashed border-muted space-y-4">
            <div className="flex justify-center text-muted">
              <Users className="w-12 h-12" />
            </div>
            <p className="font-bold text-foreground/45 italic text-sm">
              {searchQuery ? 'No contacts match your search.' : 'No customer records found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContacts.map((contact, idx) => (
              <div 
                key={idx} 
                className="bg-card rounded-xl p-5 border border-muted/50 shadow-sm space-y-4 hover:border-primary/10 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-foreground text-base flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-primary" /> {contact.name}
                    </h3>
                    <p className="text-xs font-semibold text-foreground/40 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {contact.phone || 'No phone number'}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Top Customer
                    </span>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-bold text-foreground/75 justify-end">
                      <span className="flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" /> {contact.totalOrders} order{contact.totalOrders !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-0.5 text-green-600 font-extrabold"><DollarSign className="w-3.5 h-3.5" />RM {contact.totalSpent.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Address block */}
                <div className="bg-muted/15 rounded-xl p-3.5 border border-muted/30 flex items-start gap-2 text-xs font-medium text-foreground/75">
                  <MapPin className="w-4 h-4 text-primary flex-none mt-0.5" />
                  <p className="leading-relaxed">{contact.address}</p>
                </div>

                {/* Actions row */}
                <div className="flex justify-end gap-2">
                  {contact.phone && (
                    <a
                      href={`https://wa.me/60${contact.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                        `Hi ${contact.name}! Thanks for choosing BakerFlow.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-4 bg-green-50 text-green-700 hover:bg-green-100 transition-colors rounded-xl flex items-center justify-center gap-1.5 border-2 border-green-100 text-xs font-black"
                    >
                      <MessageCircle className="w-4 h-4" /> Message Customer
                    </a>
                  )}

                  {contact.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-4 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors rounded-xl flex items-center justify-center gap-1.5 border-2 border-blue-100 text-xs font-black"
                    >
                      <MapPin className="w-4 h-4" /> View Map
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

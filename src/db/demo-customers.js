// Synthetic reviewer identities. IDs are stable; only legacy seed display names may be renamed.
export const demoCustomers=[
 ['cus_001','Demo Customer A','Olivia Bennett'],
 ['cus_002','Demo Customer B','Ethan Brooks'],
 ['cus_003','Anh Nguyen','Sophia Turner'],
 ['cus_004','Linh Tran','Liam Walker'],
 ['cus_005','Minh Pham','Ava Mitchell'],
 ['cus_006','Mai Le','Noah Carter'],
 ['cus_007','Bao Hoang','Emma Cooper'],
 ['cus_008','Trang Vo','James Anderson'],
 ['cus_009','Khanh Do','Mia Sullivan'],
 ['cus_010','Thao Bui','Benjamin Foster'],
 ['cus_011','Huy Dang','Charlotte Reed'],
 ['cus_012','Nhi Vu','Lucas Morgan'],
 ['cus_013','Long Phan','Amelia Hayes'],
 ['cus_014','Vy Nguyen','Henry Collins'],
 ['cus_015','Dat Ho','Harper Scott'],
 ['cus_016','My Dang','Daniel Parker'],
 ['cus_017','Tuan Ngo','Evelyn Wright'],
 ['cus_018','Hoa Pham','Jack Thompson'],
 ['cus_019','Kim Truong','Grace Phillips'],
 ['cus_020','Phuc Do','Samuel Young']
];
export function renameLegacyDemoCustomers(db){
 const update=db.prepare('UPDATE customers SET display_name=? WHERE id=? AND display_name=?');
 return db.transaction(()=>demoCustomers.reduce((count,[id,previous,name])=>count+update.run(name,id,previous).changes,0)).immediate();
}
